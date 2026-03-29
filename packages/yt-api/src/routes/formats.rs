use axum::Extension;
use axum::Json;
use axum::extract::State;

use crate::AppState;
use crate::error::AppError;
use crate::grpc::GrpcClientTrait;
use crate::middleware::RequestId;
use crate::models::responses::FormatsResponse;

pub async fn list_formats<C: GrpcClientTrait>(
    State(state): State<AppState<C>>,
    Extension(req_id): Extension<RequestId>,
) -> Result<Json<FormatsResponse>, AppError> {
    let result = state.grpc_client.list_formats(Some(&req_id.0)).await?;
    Ok(Json(FormatsResponse::from(result)))
}
