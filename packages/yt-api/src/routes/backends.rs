use axum::Extension;
use axum::Json;
use axum::extract::State;

use crate::AppState;
use crate::error::AppError;
use crate::grpc::GrpcClientTrait;
use crate::middleware::RequestId;
use crate::models::responses::BackendsResponse;

pub async fn list_backends<C: GrpcClientTrait>(
    State(state): State<AppState<C>>,
    Extension(req_id): Extension<RequestId>,
) -> Result<Json<BackendsResponse>, AppError> {
    let result = state.grpc_client.list_backends(Some(&req_id.0)).await?;
    Ok(Json(BackendsResponse::from(result)))
}
