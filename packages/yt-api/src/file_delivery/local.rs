use std::path::PathBuf;

use async_trait::async_trait;
use axum::body::Body;
use axum::http::header;
use axum::response::{IntoResponse, Response};
use tokio::fs::File;
use tokio_util::io::ReaderStream;

use crate::error::AppError;
use crate::file_delivery::disposition::attachment_header_value;
use crate::file_delivery::mime_from_extension;
use crate::file_delivery::FileDelivery;

pub struct LocalFileDelivery {
    downloads_dir: PathBuf,
}

impl LocalFileDelivery {
    pub fn new(downloads_dir: PathBuf) -> Self {
        Self { downloads_dir }
    }

    pub fn downloads_dir(&self) -> &PathBuf {
        &self.downloads_dir
    }
}

#[async_trait]
impl FileDelivery for LocalFileDelivery {
    async fn serve_file(&self, filename: &str) -> Result<Response, AppError> {
        let file_path = self.downloads_dir.join(filename);

        let canonical_dir = self.downloads_dir.canonicalize().map_err(|e| {
            tracing::error!(error = %e, "Downloads directory not found");
            AppError::NotFound("Downloads directory not available".to_string())
        })?;
        let canonical_file = file_path
            .canonicalize()
            .map_err(|_| AppError::NotFound(format!("File not found: {filename}")))?;
        if !canonical_file.starts_with(&canonical_dir) {
            return Err(AppError::Validation("Invalid filename".to_string()));
        }

        let file = File::open(&canonical_file).await.map_err(|e| {
            tracing::error!(error = %e, filename = %filename, "Failed to open file");
            AppError::NotFound(format!("File not found: {filename}"))
        })?;

        let metadata = file.metadata().await.map_err(|e| {
            tracing::error!(error = %e, filename = %filename, "Failed to read file metadata");
            AppError::NotFound(format!("File not found: {filename}"))
        })?;

        let stream = ReaderStream::new(file);
        let body = Body::from_stream(stream);

        let content_type = mime_from_extension(filename);
        let disposition = attachment_header_value(filename)?;

        tracing::info!(filename = %filename, bytes = metadata.len(), "serving local download file");

        Ok(Response::builder()
            .header(header::CONTENT_TYPE, content_type)
            .header(header::CONTENT_LENGTH, metadata.len())
            .header(header::CONTENT_DISPOSITION, disposition)
            .body(body)
            .unwrap()
            .into_response())
    }
}
