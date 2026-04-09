use std::sync::atomic::Ordering;

use axum::Json;
use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde::Deserialize;
use serde_json::json;

use crate::AppState;
use crate::grpc::GrpcClientTrait;

#[derive(Deserialize)]
pub struct HealthQuery {
    #[serde(default)]
    deep: bool,
}

pub async fn health<C: GrpcClientTrait>(
    State(state): State<AppState<C>>,
    Query(query): Query<HealthQuery>,
) -> Response {
    if state.shutting_down.load(Ordering::SeqCst) {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({ "status": "shutting_down" })),
        )
            .into_response();
    }

    if query.deep {
        match state.grpc_client.list_backends(None).await {
            Ok(_) => (
                StatusCode::OK,
                Json(json!({ "status": "ok", "grpc": "connected" })),
            )
                .into_response(),
            Err(e) => (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({
                    "status": "degraded",
                    "grpc": format!("unreachable: {}", e.message())
                })),
            )
                .into_response(),
        }
    } else {
        (StatusCode::OK, Json(json!({ "status": "ok" }))).into_response()
    }
}
