use axum::Json;
use axum::extract::State;

use crate::AppState;
use crate::error::AppError;
use crate::models::responses::FormatsResponse;

pub async fn list_formats(
    State(state): State<AppState>,
) -> Result<Json<FormatsResponse>, AppError> {
    let result = state.grpc_client.list_formats().await?;
    Ok(Json(FormatsResponse::from(result)))
}
