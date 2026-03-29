use std::sync::atomic::Ordering;

use axum::Json;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde_json::json;

use crate::AppState;
use crate::grpc::GrpcClientTrait;

pub async fn health<C: GrpcClientTrait>(State(state): State<AppState<C>>) -> Response {
    if state.shutting_down.load(Ordering::SeqCst) {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({ "status": "shutting_down" })),
        )
            .into_response()
    } else {
        (StatusCode::OK, Json(json!({ "status": "ok" }))).into_response()
    }
}
