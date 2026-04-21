mod disposition;
mod local;
mod mime;
mod remote;

pub use local::LocalFileDelivery;
pub use mime::mime_from_extension;
pub use remote::RemoteFileDelivery;

use std::sync::Arc;

use axum::response::Response;
use async_trait::async_trait;

use crate::config::{Config, FileDeliveryMode};
use crate::error::AppError;

#[async_trait]
pub trait FileDelivery: Send + Sync {
    async fn serve_file(&self, filename: &str) -> Result<Response, AppError>;
}

pub fn build(
    config: &Config,
    http_client: reqwest::Client,
) -> Arc<dyn FileDelivery + Send + Sync> {
    match config.file_delivery_mode {
        FileDeliveryMode::Local => Arc::new(LocalFileDelivery::new(config.download_dir.clone())),
        FileDeliveryMode::Remote => Arc::new(RemoteFileDelivery::new(
            http_client,
            config
                .internal_file_base_url
                .clone()
                .expect("validated at startup: INTERNAL_FILE_BASE_URL"),
            config
                .internal_api_key
                .clone()
                .expect("validated at startup: INTERNAL_API_KEY"),
        )),
    }
}
