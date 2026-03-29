use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;

pub mod error_codes {
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
}

#[derive(serde::Serialize)]
pub struct ErrorResponse {
    pub code: &'static str,
    pub message: String,
    pub retryable: bool,
}

#[allow(dead_code)]
pub enum AppError {
    GrpcConnection(tonic::transport::Error),
    GrpcCall(tonic::Status),
    BadRequest(String),
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
            AppError::GrpcCall(grpc_status) => {
                // Try to parse JSON from gRPC status message
                if let Ok(parsed) =
                    serde_json::from_str::<serde_json::Value>(grpc_status.message())
                {
                    if let (Some(code), Some(message)) = (
                        parsed.get("code").and_then(|c| c.as_str()),
                        parsed.get("message").and_then(|m| m.as_str()),
                    ) {
                        let retryable = parsed
                            .get("retryable")
                            .and_then(|r| r.as_bool())
                            .unwrap_or(false);
                        let http_status = code_to_http_status(code);
                        // code is from parsed JSON (a &str), but we need &'static str.
                        // Map known codes to their static constants, fallback to GRPC_ERROR.
                        let static_code = match_code_str(code);
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

                // Fallback: map gRPC status code
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
                    ErrorResponse {
                        code,
                        message: grpc_status.message().to_string(),
                        retryable,
                    },
                )
            }
            AppError::BadRequest(msg) => (
                StatusCode::BAD_REQUEST,
                ErrorResponse {
                    code: error_codes::VALIDATION_ERROR,
                    message: msg,
                    retryable: false,
                },
            ),
        };

        (status, Json(error_response)).into_response()
    }
}

fn code_to_http_status(code: &str) -> StatusCode {
    match code {
        error_codes::VALIDATION_ERROR | error_codes::INVALID_URL => StatusCode::BAD_REQUEST,
        error_codes::VIDEO_NOT_FOUND => StatusCode::NOT_FOUND,
        error_codes::METADATA_FAILED => StatusCode::BAD_GATEWAY,
        error_codes::DOWNLOAD_FAILED
        | error_codes::DEPENDENCY_MISSING
        | error_codes::INTERNAL_ERROR => StatusCode::INTERNAL_SERVER_ERROR,
        error_codes::SERVICE_UNAVAILABLE => StatusCode::SERVICE_UNAVAILABLE,
        error_codes::REQUEST_TIMEOUT => StatusCode::GATEWAY_TIMEOUT,
        error_codes::CANCELLED => StatusCode::BAD_REQUEST,
        _ => StatusCode::INTERNAL_SERVER_ERROR,
    }
}

fn match_code_str(code: &str) -> &'static str {
    match code {
        "VALIDATION_ERROR" => error_codes::VALIDATION_ERROR,
        "INVALID_URL" => error_codes::INVALID_URL,
        "VIDEO_NOT_FOUND" => error_codes::VIDEO_NOT_FOUND,
        "METADATA_FAILED" => error_codes::METADATA_FAILED,
        "DOWNLOAD_FAILED" => error_codes::DOWNLOAD_FAILED,
        "DEPENDENCY_MISSING" => error_codes::DEPENDENCY_MISSING,
        "SERVICE_UNAVAILABLE" => error_codes::SERVICE_UNAVAILABLE,
        "REQUEST_TIMEOUT" => error_codes::REQUEST_TIMEOUT,
        "CANCELLED" => error_codes::CANCELLED,
        "INTERNAL_ERROR" => error_codes::INTERNAL_ERROR,
        "SERIALIZATION_ERROR" => error_codes::SERIALIZATION_ERROR,
        "GRPC_ERROR" => error_codes::GRPC_ERROR,
        _ => error_codes::GRPC_ERROR,
    }
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
