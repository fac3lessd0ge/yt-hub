use axum::Json;
use axum::extract::State;

use crate::AppState;
use crate::error::AppError;
use crate::models::responses::BackendsResponse;

pub async fn list_backends(
    State(state): State<AppState>,
) -> Result<Json<BackendsResponse>, AppError> {
    let result = state.grpc_client.list_backends().await?;
    Ok(Json(BackendsResponse::from(result)))
}
