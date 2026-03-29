mod backends;
mod downloads;
mod formats;
mod health;
mod metadata;
mod metrics;

use axum::Router;
use axum::routing::{get, post};

use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/health", get(health::health))
        .route("/api/metadata", get(metadata::get_metadata))
        .route("/api/formats", get(formats::list_formats))
        .route("/api/backends", get(backends::list_backends))
        .route("/api/downloads", post(downloads::download))
}

pub fn metrics_router() -> Router<AppState> {
    Router::new().route("/metrics", get(metrics::metrics))
}
