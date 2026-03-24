use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

#[allow(dead_code)]
pub enum AppError {
    GrpcConnection(tonic::transport::Error),
    GrpcCall(tonic::Status),
    BadRequest(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::GrpcConnection(_) => (
                StatusCode::SERVICE_UNAVAILABLE,
                "Download service is unavailable".to_string(),
            ),
            AppError::GrpcCall(status) => {
                let http_status = match status.code() {
                    tonic::Code::NotFound => StatusCode::NOT_FOUND,
                    tonic::Code::InvalidArgument => StatusCode::BAD_REQUEST,
                    tonic::Code::Unavailable => StatusCode::SERVICE_UNAVAILABLE,
                    _ => StatusCode::INTERNAL_SERVER_ERROR,
                };
                (http_status, status.message().to_string())
            }
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
        };

        (status, Json(json!({ "error": message }))).into_response()
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
