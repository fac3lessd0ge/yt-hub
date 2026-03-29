use axum::extract::State;
use axum::response::{IntoResponse, Response};
use axum::http::header;

use crate::AppState;

pub async fn metrics(State(state): State<AppState>) -> Response {
    let body = state.metrics_handle.render();
    (
        [(header::CONTENT_TYPE, "text/plain; version=0.0.4; charset=utf-8")],
        body,
    )
        .into_response()
}
