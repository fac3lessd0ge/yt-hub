use axum::Json;
use axum::extract::{Query, State};

use crate::AppState;
use crate::error::AppError;
use crate::models::requests::MetadataQuery;
use crate::models::responses::MetadataResponse;

pub async fn get_metadata(
    State(state): State<AppState>,
    Query(query): Query<MetadataQuery>,
) -> Result<Json<MetadataResponse>, AppError> {
    let result = state.grpc_client.get_metadata(&query.link).await?;
    Ok(Json(MetadataResponse::from(result)))
}
