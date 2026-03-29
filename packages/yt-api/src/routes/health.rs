use std::sync::atomic::Ordering;

use axum::Json;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde_json::json;

use crate::AppState;

pub async fn health(State(state): State<AppState>) -> Response {
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
