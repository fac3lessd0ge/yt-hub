use std::convert::Infallible;

use axum::Extension;
use axum::Json;
use axum::extract::State;
use axum::response::sse::{Event, Sse};
use serde_json::json;
use tokio_stream::StreamExt;

use crate::AppState;
use crate::error::AppError;
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

pub async fn download(
    State(state): State<AppState>,
    Extension(req_id): Extension<RequestId>,
    Json(body): Json<DownloadRequestBody>,
) -> Result<Sse<impl tokio_stream::Stream<Item = Result<Event, Infallible>>>, AppError> {
    validation::validate_youtube_url(&body.link).map_err(AppError::Validation)?;
    validation::validate_format(&body.format).map_err(AppError::Validation)?;
    validation::validate_name(&body.name).map_err(AppError::Validation)?;
    if let Some(ref dest) = body.destination {
        validation::validate_destination(dest).map_err(AppError::Validation)?;
    }

    let grpc_request: proto::DownloadRequest = body.into();
    let stream = state.grpc_client.download(grpc_request, Some(&req_id.0)).await?;

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
                    let data = DownloadComplete {
                        output_path: c.output_path,
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

    Ok(Sse::new(sse_stream))
}
