use async_trait::async_trait;
use axum::body::Body;
use axum::http::header;
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use percent_encoding::{NON_ALPHANUMERIC, utf8_percent_encode};

use crate::error::AppError;
use crate::file_delivery::disposition::attachment_header_value;
use crate::file_delivery::mime_from_extension;
use crate::file_delivery::FileDelivery;
use crate::internal_protocol::{HEADER_INTERNAL_API_KEY, PATH_INTERNAL_FILES_PREFIX};

pub struct RemoteFileDelivery {
    http_client: reqwest::Client,
    internal_file_base_url: String,
    internal_api_key: String,
}

impl RemoteFileDelivery {
    pub fn new(
        http_client: reqwest::Client,
        internal_file_base_url: String,
        internal_api_key: String,
    ) -> Self {
        Self {
            http_client,
            internal_file_base_url,
            internal_api_key,
        }
    }

    fn upstream_file_url(&self, filename: &str) -> String {
        let encoded = utf8_percent_encode(filename, NON_ALPHANUMERIC).to_string();
        format!(
            "{}{}{}",
            self.internal_file_base_url.trim_end_matches('/'),
            PATH_INTERNAL_FILES_PREFIX,
            encoded
        )
    }
}

#[async_trait]
impl FileDelivery for RemoteFileDelivery {
    async fn serve_file(&self, filename: &str) -> Result<Response, AppError> {
        let upstream_url = self.upstream_file_url(filename);

        let upstream = self
            .http_client
            .get(&upstream_url)
            .header(HEADER_INTERNAL_API_KEY, &self.internal_api_key)
            .send()
            .await
            .map_err(|e| {
                tracing::error!(error = %e, %upstream_url, "Failed to reach internal file endpoint");
                if e.is_timeout() {
                    AppError::UpstreamUnavailable(
                        "Internal file request timed out".to_string(),
                    )
                } else {
                    AppError::UpstreamUnavailable(format!(
                        "Internal file service is unavailable: {e}"
                    ))
                }
            })?;

        let status = upstream.status();
        if status == StatusCode::NOT_FOUND {
            return Err(AppError::NotFound(format!("File not found: {filename}")));
        }

        if !status.is_success() {
            tracing::error!(status = %status, %upstream_url, "Internal file endpoint returned non-success status");
            return Err(AppError::UpstreamUnavailable(
                "Failed to retrieve file from internal service".to_string(),
            ));
        }

        tracing::info!(filename = %filename, %upstream_url, "internal file proxy streaming response started");

        let mut headers = HeaderMap::new();
        for (src_name, dst_name) in UPSTREAM_HEADER_PAIRS {
            copy_header_if_present(upstream.headers(), &mut headers, src_name, dst_name);
        }

        if !headers.contains_key(header::CONTENT_TYPE) {
            headers.insert(
                header::CONTENT_TYPE,
                HeaderValue::from_static(mime_from_extension(filename)),
            );
        }
        if !headers.contains_key(header::CONTENT_DISPOSITION) {
            if let Ok(header_value) = attachment_header_value(filename) {
                headers.insert(header::CONTENT_DISPOSITION, header_value);
            }
        }

        let stream = upstream.bytes_stream();
        let body = Body::from_stream(stream);

        Ok((StatusCode::OK, headers, body).into_response())
    }
}

const UPSTREAM_HEADER_PAIRS: &[(reqwest::header::HeaderName, header::HeaderName)] = &[
    (reqwest::header::CONTENT_TYPE, header::CONTENT_TYPE),
    (reqwest::header::CONTENT_LENGTH, header::CONTENT_LENGTH),
    (reqwest::header::CONTENT_DISPOSITION, header::CONTENT_DISPOSITION),
];

fn copy_header_if_present(
    source: &reqwest::header::HeaderMap,
    target: &mut HeaderMap,
    source_name: &reqwest::header::HeaderName,
    target_name: &header::HeaderName,
) {
    if let Some(value) = source.get(source_name) {
        if let Ok(converted) = HeaderValue::from_bytes(value.as_bytes()) {
            target.insert(target_name.clone(), converted);
        }
    }
}
