mod backends;
mod downloads;
mod formats;
mod metadata;

use axum::Router;
use axum::routing::{get, post};

use crate::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/metadata", get(metadata::get_metadata))
        .route("/api/formats", get(formats::list_formats))
        .route("/api/backends", get(backends::list_backends))
        .route("/api/downloads", post(downloads::download))
}
