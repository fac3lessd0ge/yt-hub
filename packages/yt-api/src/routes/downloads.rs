use std::convert::Infallible;
use std::path::Path;

use axum::Extension;
use axum::Json;
use axum::extract::{self, State};
use axum::response::sse::{Event, Sse};
use axum::response::Response;
use serde_json::json;
use tokio_stream::StreamExt;

use crate::AppState;
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

    let tracked_stream = SseStreamGuard::new(sse_stream);

    Ok(Sse::new(tracked_stream))
}

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
    state.file_delivery.serve_file(&filename).await
}
