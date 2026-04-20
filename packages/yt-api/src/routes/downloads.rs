use std::convert::Infallible;
use std::path::Path;

use axum::Extension;
use axum::Json;
use axum::body::Body;
use axum::extract::{self, State};
use axum::http::header;
use axum::http::{HeaderMap, HeaderValue, StatusCode};
use axum::response::sse::{Event, Sse};
use axum::response::{IntoResponse, Response};
use serde_json::json;
use tokio::fs::File;
use tokio_stream::StreamExt;
use tokio_util::io::ReaderStream;

use crate::AppState;
use crate::FileDeliveryMode;
use crate::error::AppError;
use crate::grpc::GrpcClientTrait;
use crate::middleware::RequestId;
use crate::models::requests::DownloadRequestBody;
use crate::models::responses::{DownloadComplete, DownloadProgress};
use crate::proto;
use crate::validation;

fn serialization_error_event(err: axum::Error) -> Event {
    let body = json!({
        "code": "SERIALIZATION_ERROR",
        "message": format!("Failed to serialize SSE payload: {err}"),
        "retryable": false
    });
    Event::default()
        .event("error")
        .data(body.to_string())
}

pub async fn download<C: GrpcClientTrait>(
    State(state): State<AppState<C>>,
    Extension(req_id): Extension<RequestId>,
    Json(body): Json<DownloadRequestBody>,
) -> Result<Sse<impl tokio_stream::Stream<Item = Result<Event, Infallible>>>, AppError> {
    validation::validate_youtube_url(&body.link).map_err(AppError::Validation)?;
    validation::validate_format(&body.format).map_err(AppError::Validation)?;
    validation::validate_name(&body.name).map_err(AppError::Validation)?;
    if let Some(ref dest) = body.destination {
        validation::validate_destination(dest, &state.downloads_dir).map_err(AppError::Validation)?;
    }

    let grpc_request: proto::DownloadRequest = body.into();
    let stream = state.grpc_client.download(grpc_request, Some(&req_id.0)).await?;

    metrics::gauge!("active_sse_streams").increment(1.0);

    let sse_stream = stream.map(|result| {
        let event = match result {
            Ok(response) => match response.payload {
                Some(proto::download_response::Payload::Progress(p)) => {
                    let data = DownloadProgress {
                        percent: p.percent,
                        speed: p.speed,
                        eta: p.eta,
                    };
                    Event::default()
                        .event("progress")
                        .json_data(data)
                        .unwrap_or_else(serialization_error_event)
                }
                Some(proto::download_response::Payload::Complete(c)) => {
                    let download_url = Path::new(&c.output_path)
                        .file_name()
                        .and_then(|f| f.to_str())
                        .map(|f| format!("/api/downloads/{f}"))
                        .unwrap_or_default();
                    let data = DownloadComplete {
                        output_path: c.output_path,
                        download_url,
                        title: c.title,
                        author_name: c.author_name,
                        format_id: c.format_id,
                        format_label: c.format_label,
                    };
                    Event::default()
                        .event("complete")
                        .json_data(data)
                        .unwrap_or_else(serialization_error_event)
                }
                Some(proto::download_response::Payload::Error(e)) => {
                    let body = json!({
                        "code": e.code,
                        "message": e.message,
                        "retryable": false
                    });
                    Event::default()
                        .event("error")
                        .data(body.to_string())
                }
                None => Event::default().comment("empty payload"),
            },
            Err(status) => {
                let retryable = matches!(
                    status.code(),
                    tonic::Code::Unavailable | tonic::Code::DeadlineExceeded
                );
                let body = json!({
                    "code": "GRPC_ERROR",
                    "message": status.message(),
                    "retryable": retryable
                });
                Event::default()
                    .event("error")
                    .data(body.to_string())
            }
        };
        Ok(event)
    });

    // Wrap the stream so the gauge is decremented when the stream is exhausted or dropped
    let tracked_stream = SseStreamGuard::new(sse_stream);

    Ok(Sse::new(tracked_stream))
}

/// Wrapper that decrements active_sse_streams gauge on drop.
struct SseStreamGuard<S> {
    inner: S,
}

impl<S> SseStreamGuard<S> {
    fn new(inner: S) -> Self {
        Self { inner }
    }
}

impl<S> Drop for SseStreamGuard<S> {
    fn drop(&mut self) {
        metrics::gauge!("active_sse_streams").decrement(1.0);
    }
}

impl<S> tokio_stream::Stream for SseStreamGuard<S>
where
    S: tokio_stream::Stream + Unpin,
{
    type Item = S::Item;

    fn poll_next(
        mut self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Option<Self::Item>> {
        std::pin::Pin::new(&mut self.inner).poll_next(cx)
    }
}

pub async fn serve_file<C: GrpcClientTrait>(
    State(state): State<AppState<C>>,
    extract::Path(filename): extract::Path<String>,
) -> Result<Response, AppError> {
    validation::validate_filename(&filename).map_err(AppError::Validation)?;

    match state.file_delivery_mode {
        FileDeliveryMode::Local => serve_file_local(&state, &filename).await,
        FileDeliveryMode::Remote => serve_file_remote(&state, &filename).await,
    }
}

async fn serve_file_local<C: GrpcClientTrait>(
    state: &AppState<C>,
    filename: &str,
) -> Result<Response, AppError> {
    let file_path = state.downloads_dir.join(filename);

    // Ensure the resolved path is still within downloads_dir (defense in depth)
    let canonical_dir = state.downloads_dir.canonicalize().map_err(|e| {
        tracing::error!(error = %e, "Downloads directory not found");
        AppError::NotFound("Downloads directory not available".to_string())
    })?;
    let canonical_file = file_path.canonicalize().map_err(|_| {
        AppError::NotFound(format!("File not found: {filename}"))
    })?;
    if !canonical_file.starts_with(&canonical_dir) {
        return Err(AppError::Validation("Invalid filename".to_string()));
    }

    // Open file first, then get metadata from the handle to avoid TOCTOU race
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

    let ascii_filename: String = filename
        .chars()
        .map(|c| if c.is_ascii() { c } else { '_' })
        .collect();
    let encoded: String = filename
        .bytes()
        .map(|b| {
            if b.is_ascii_alphanumeric() || b == b'-' || b == b'_' || b == b'.' {
                format!("{}", b as char)
            } else {
                format!("%{b:02X}")
            }
        })
        .collect();
    let disposition = format!(
        "attachment; filename=\"{ascii_filename}\"; filename*=UTF-8''{encoded}"
    );

    Ok(Response::builder()
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CONTENT_LENGTH, metadata.len())
        .header(header::CONTENT_DISPOSITION, disposition)
        .body(body)
        .unwrap()
        .into_response())
}

async fn serve_file_remote<C: GrpcClientTrait>(
    state: &AppState<C>,
    filename: &str,
) -> Result<Response, AppError> {
    let base_url = state
        .internal_file_base_url
        .as_deref()
        .ok_or_else(|| AppError::Validation("INTERNAL_FILE_BASE_URL is not configured".to_string()))?;
    let api_key = state
        .internal_api_key
        .as_deref()
        .ok_or_else(|| AppError::Validation("INTERNAL_API_KEY is not configured".to_string()))?;

    let upstream_url = format!(
        "{}/internal/files/{}",
        base_url.trim_end_matches('/'),
        filename
    );

    let upstream = state
        .http_client
        .get(&upstream_url)
        .header("x-internal-api-key", api_key)
        .send()
        .await
        .map_err(|e| {
            tracing::error!(error = %e, %upstream_url, "Failed to reach internal file endpoint");
            AppError::GrpcCall(tonic::Status::unavailable("Internal file service is unavailable"))
        })?;

    let status = upstream.status();
    if status == StatusCode::NOT_FOUND {
        return Err(AppError::NotFound(format!("File not found: {filename}")));
    }

    if !status.is_success() {
        tracing::error!(status = %status, %upstream_url, "Internal file endpoint returned non-success status");
        return Err(AppError::GrpcCall(tonic::Status::unavailable(
            "Failed to retrieve file from internal service",
        )));
    }

    let mut headers = HeaderMap::new();
    copy_header_if_present(
        upstream.headers(),
        &mut headers,
        reqwest::header::CONTENT_TYPE,
        header::CONTENT_TYPE,
    );
    copy_header_if_present(
        upstream.headers(),
        &mut headers,
        reqwest::header::CONTENT_LENGTH,
        header::CONTENT_LENGTH,
    );
    copy_header_if_present(
        upstream.headers(),
        &mut headers,
        reqwest::header::CONTENT_DISPOSITION,
        header::CONTENT_DISPOSITION,
    );

    if !headers.contains_key(header::CONTENT_TYPE) {
        headers.insert(
            header::CONTENT_TYPE,
            HeaderValue::from_static(mime_from_extension(filename)),
        );
    }
    if !headers.contains_key(header::CONTENT_DISPOSITION) {
        let disposition = content_disposition_for(filename);
        if let Ok(header_value) = HeaderValue::from_str(&disposition) {
            headers.insert(header::CONTENT_DISPOSITION, header_value);
        }
    }

    let stream = upstream.bytes_stream();
    let body = Body::from_stream(stream);

    Ok((StatusCode::OK, headers, body).into_response())
}

fn copy_header_if_present(
    source: &reqwest::header::HeaderMap,
    target: &mut HeaderMap,
    source_name: reqwest::header::HeaderName,
    target_name: header::HeaderName,
) {
    if let Some(value) = source.get(source_name) {
        if let Ok(converted) = HeaderValue::from_bytes(value.as_bytes()) {
            target.insert(target_name, converted);
        }
    }
}

fn content_disposition_for(filename: &str) -> String {
    let ascii_filename: String = filename
        .chars()
        .map(|c| if c.is_ascii() { c } else { '_' })
        .collect();
    let encoded: String = filename
        .bytes()
        .map(|b| {
            if b.is_ascii_alphanumeric() || b == b'-' || b == b'_' || b == b'.' {
                format!("{}", b as char)
            } else {
                format!("%{b:02X}")
            }
        })
        .collect();
    format!("attachment; filename=\"{ascii_filename}\"; filename*=UTF-8''{encoded}")
}

fn mime_from_extension(filename: &str) -> &'static str {
    match Path::new(filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
    {
        "mp3" => "audio/mpeg",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "m4a" => "audio/mp4",
        "ogg" | "oga" => "audio/ogg",
        "wav" => "audio/wav",
        "flac" => "audio/flac",
        "mkv" => "video/x-matroska",
        _ => "application/octet-stream",
    }
}
