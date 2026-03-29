mod backends;
mod downloads;
mod formats;
mod health;
mod metadata;
mod metrics;

use axum::Router;
use axum::routing::{get, post};

use crate::AppState;
use crate::grpc::GrpcClientTrait;

pub fn router<C: GrpcClientTrait>() -> Router<AppState<C>> {
    Router::new()
        .route("/health", get(health::health::<C>))
        .route("/api/metadata", get(metadata::get_metadata::<C>))
        .route("/api/formats", get(formats::list_formats::<C>))
        .route("/api/backends", get(backends::list_backends::<C>))
        .route("/api/downloads", post(downloads::download::<C>))
}

pub fn metrics_router() -> Router<AppState> {
    Router::new().route("/metrics", get(metrics::metrics))
}
