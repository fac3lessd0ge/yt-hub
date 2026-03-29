use axum::Extension;
use axum::Json;
use axum::extract::{Query, State};

use crate::AppState;
use crate::error::AppError;
use crate::middleware::RequestId;
use crate::models::requests::MetadataQuery;
use crate::models::responses::MetadataResponse;
use crate::validation;

pub async fn get_metadata(
    State(state): State<AppState>,
    Extension(req_id): Extension<RequestId>,
    Query(query): Query<MetadataQuery>,
) -> Result<Json<MetadataResponse>, AppError> {
    validation::validate_youtube_url(&query.link).map_err(AppError::Validation)?;
    let result = state.grpc_client.get_metadata(&query.link, Some(&req_id.0)).await?;
    Ok(Json(MetadataResponse::from(result)))
}
