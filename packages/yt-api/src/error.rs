use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;

pub mod error_codes {
    use axum::http::StatusCode;

    pub const VALIDATION_ERROR: &str = "VALIDATION_ERROR";
    pub const INVALID_URL: &str = "INVALID_URL";
    pub const VIDEO_NOT_FOUND: &str = "VIDEO_NOT_FOUND";
    pub const METADATA_FAILED: &str = "METADATA_FAILED";
    pub const DOWNLOAD_FAILED: &str = "DOWNLOAD_FAILED";
    pub const DEPENDENCY_MISSING: &str = "DEPENDENCY_MISSING";
    pub const SERVICE_UNAVAILABLE: &str = "SERVICE_UNAVAILABLE";
    pub const REQUEST_TIMEOUT: &str = "REQUEST_TIMEOUT";
    pub const CANCELLED: &str = "CANCELLED";
    pub const INTERNAL_ERROR: &str = "INTERNAL_ERROR";
    pub const SERIALIZATION_ERROR: &str = "SERIALIZATION_ERROR";
    pub const GRPC_ERROR: &str = "GRPC_ERROR";
    pub const FILE_NOT_FOUND: &str = "FILE_NOT_FOUND";
    pub const RATE_LIMIT_EXCEEDED: &str = "RATE_LIMIT_EXCEEDED";

    /// Map a code string to its static constant, falling back to GRPC_ERROR.
    pub fn to_static(code: &str) -> &'static str {
        match code {
            "VALIDATION_ERROR" => VALIDATION_ERROR,
            "INVALID_URL" => INVALID_URL,
            "VIDEO_NOT_FOUND" => VIDEO_NOT_FOUND,
            "METADATA_FAILED" => METADATA_FAILED,
            "DOWNLOAD_FAILED" => DOWNLOAD_FAILED,
            "DEPENDENCY_MISSING" => DEPENDENCY_MISSING,
            "SERVICE_UNAVAILABLE" => SERVICE_UNAVAILABLE,
            "REQUEST_TIMEOUT" => REQUEST_TIMEOUT,
            "CANCELLED" => CANCELLED,
            "INTERNAL_ERROR" => INTERNAL_ERROR,
            "SERIALIZATION_ERROR" => SERIALIZATION_ERROR,
            "GRPC_ERROR" => GRPC_ERROR,
            "FILE_NOT_FOUND" => FILE_NOT_FOUND,
            "RATE_LIMIT_EXCEEDED" => RATE_LIMIT_EXCEEDED,
            _ => GRPC_ERROR,
        }
    }

    pub fn to_http_status(code: &str) -> StatusCode {
        match code {
            VALIDATION_ERROR | INVALID_URL | CANCELLED => StatusCode::BAD_REQUEST,
            VIDEO_NOT_FOUND | FILE_NOT_FOUND => StatusCode::NOT_FOUND,
            RATE_LIMIT_EXCEEDED => StatusCode::TOO_MANY_REQUESTS,
            METADATA_FAILED => StatusCode::BAD_GATEWAY,
            SERVICE_UNAVAILABLE => StatusCode::SERVICE_UNAVAILABLE,
            REQUEST_TIMEOUT => StatusCode::GATEWAY_TIMEOUT,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

#[derive(serde::Serialize)]
pub struct ErrorResponse {
    pub code: &'static str,
    pub message: String,
    pub retryable: bool,
}

pub enum AppError {
    GrpcConnection(tonic::transport::Error),
    GrpcCall(tonic::Status),
    Validation(String),
    NotFound(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_response) = match self {
            AppError::GrpcConnection(_) => (
                StatusCode::SERVICE_UNAVAILABLE,
                ErrorResponse {
                    code: error_codes::SERVICE_UNAVAILABLE,
                    message: "Download service is unavailable".to_string(),
                    retryable: true,
                },
            ),
            AppError::GrpcCall(grpc_status) => return grpc_status_to_response(grpc_status),
            AppError::Validation(msg) => (
                StatusCode::BAD_REQUEST,
                ErrorResponse {
                    code: error_codes::VALIDATION_ERROR,
                    message: msg,
                    retryable: false,
                },
            ),
            AppError::NotFound(msg) => (
                StatusCode::NOT_FOUND,
                ErrorResponse {
                    code: error_codes::FILE_NOT_FOUND,
                    message: msg,
                    retryable: false,
                },
            ),
        };

        (status, Json(error_response)).into_response()
    }
}

/// Convert a gRPC status to an HTTP response.
/// First tries to parse structured JSON from the status message (sent by yt-service ErrorMapper),
/// then falls back to mapping the gRPC status code directly.
fn grpc_status_to_response(grpc_status: tonic::Status) -> Response {
    // Try to parse JSON error payload from yt-service
    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(grpc_status.message()) {
        if let (Some(code), Some(message)) = (
            parsed.get("code").and_then(|c| c.as_str()),
            parsed.get("message").and_then(|m| m.as_str()),
        ) {
            let retryable = parsed
                .get("retryable")
                .and_then(|r| r.as_bool())
                .unwrap_or(false);
            let static_code = error_codes::to_static(code);
            let http_status = error_codes::to_http_status(code);
            return (
                http_status,
                Json(ErrorResponse {
                    code: static_code,
                    message: message.to_string(),
                    retryable,
                }),
            )
                .into_response();
        }
    }

    // Fallback: map gRPC status code directly
    let (http_status, code, retryable) = match grpc_status.code() {
        tonic::Code::NotFound => {
            (StatusCode::NOT_FOUND, error_codes::VIDEO_NOT_FOUND, false)
        }
        tonic::Code::InvalidArgument => {
            (StatusCode::BAD_REQUEST, error_codes::VALIDATION_ERROR, false)
        }
        tonic::Code::Unavailable => (
            StatusCode::SERVICE_UNAVAILABLE,
            error_codes::SERVICE_UNAVAILABLE,
            true,
        ),
        tonic::Code::DeadlineExceeded => (
            StatusCode::GATEWAY_TIMEOUT,
            error_codes::REQUEST_TIMEOUT,
            true,
        ),
        tonic::Code::Cancelled => {
            (StatusCode::BAD_REQUEST, error_codes::CANCELLED, false)
        }
        _ => (
            StatusCode::INTERNAL_SERVER_ERROR,
            error_codes::INTERNAL_ERROR,
            false,
        ),
    };
    (
        http_status,
        Json(ErrorResponse {
            code,
            message: grpc_status.message().to_string(),
            retryable,
        }),
    )
        .into_response()
}

impl From<tonic::transport::Error> for AppError {
    fn from(err: tonic::transport::Error) -> Self {
        AppError::GrpcConnection(err)
    }
}

impl From<tonic::Status> for AppError {
    fn from(status: tonic::Status) -> Self {
        AppError::GrpcCall(status)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::response::IntoResponse;
    use http_body_util::BodyExt;

    async fn response_to_json(resp: Response) -> (StatusCode, serde_json::Value) {
        let status = resp.status();
        let body = resp.into_body();
        let bytes = body.collect().await.unwrap().to_bytes();
        let json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        (status, json)
    }

    #[tokio::test]
    async fn validation_returns_400() {
        let err = AppError::Validation("bad url".into());
        let (status, json) = response_to_json(err.into_response()).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(json["code"], "VALIDATION_ERROR");
        assert_eq!(json["message"], "bad url");
        assert_eq!(json["retryable"], false);
    }

    #[tokio::test]
    async fn not_found_returns_404() {
        let err = AppError::NotFound("file missing".into());
        let (status, json) = response_to_json(err.into_response()).await;
        assert_eq!(status, StatusCode::NOT_FOUND);
        assert_eq!(json["code"], "FILE_NOT_FOUND");
        assert_eq!(json["message"], "file missing");
    }

    #[tokio::test]
    async fn grpc_not_found_returns_404() {
        let err = AppError::GrpcCall(tonic::Status::not_found("video missing"));
        let (status, json) = response_to_json(err.into_response()).await;
        assert_eq!(status, StatusCode::NOT_FOUND);
        assert_eq!(json["code"], "VIDEO_NOT_FOUND");
        assert_eq!(json["message"], "video missing");
        assert_eq!(json["retryable"], false);
    }

    #[tokio::test]
    async fn grpc_invalid_argument_returns_400() {
        let err = AppError::GrpcCall(tonic::Status::invalid_argument("bad arg"));
        let (status, json) = response_to_json(err.into_response()).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(json["code"], "VALIDATION_ERROR");
        assert_eq!(json["retryable"], false);
    }

    #[tokio::test]
    async fn grpc_unavailable_returns_503_retryable() {
        let err = AppError::GrpcCall(tonic::Status::unavailable("service down"));
        let (status, json) = response_to_json(err.into_response()).await;
        assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
        assert_eq!(json["code"], "SERVICE_UNAVAILABLE");
        assert_eq!(json["retryable"], true);
    }

    #[tokio::test]
    async fn grpc_deadline_exceeded_returns_504_retryable() {
        let err = AppError::GrpcCall(tonic::Status::deadline_exceeded("timeout"));
        let (status, json) = response_to_json(err.into_response()).await;
        assert_eq!(status, StatusCode::GATEWAY_TIMEOUT);
        assert_eq!(json["code"], "REQUEST_TIMEOUT");
        assert_eq!(json["retryable"], true);
    }

    #[tokio::test]
    async fn grpc_cancelled_returns_400() {
        let err = AppError::GrpcCall(tonic::Status::cancelled("user cancelled"));
        let (status, json) = response_to_json(err.into_response()).await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(json["code"], "CANCELLED");
        assert_eq!(json["retryable"], false);
    }

    #[tokio::test]
    async fn grpc_internal_returns_500() {
        let err = AppError::GrpcCall(tonic::Status::internal("oops"));
        let (status, json) = response_to_json(err.into_response()).await;
        assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(json["code"], "INTERNAL_ERROR");
        assert_eq!(json["retryable"], false);
    }

    #[tokio::test]
    async fn grpc_json_status_message_extracts_code_and_message() {
        let json_msg = serde_json::json!({
            "code": "DOWNLOAD_FAILED",
            "message": "ffmpeg crashed",
            "retryable": true
        });
        let err = AppError::GrpcCall(tonic::Status::unknown(json_msg.to_string()));
        let (status, json) = response_to_json(err.into_response()).await;
        assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(json["code"], "DOWNLOAD_FAILED");
        assert_eq!(json["message"], "ffmpeg crashed");
        assert_eq!(json["retryable"], true);
    }
}
