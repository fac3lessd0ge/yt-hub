mod common;

use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use serde_json::json;
use tower::ServiceExt;
use yt_api::proto::{
    download_response, DownloadComplete, DownloadError, DownloadProgress, DownloadResponse,
};

fn download_body(link: &str, format: &str, name: &str) -> String {
    json!({
        "link": link,
        "format": format,
        "name": name,
    })
    .to_string()
}

const VALID_LINK: &str = "https://www.youtube.com/watch?v=abc123";

// --- Validation failures (400 before SSE starts) ---

#[tokio::test]
async fn download_bad_url_returns_400() {
    let mock = common::MockGrpcClient::builder().build();
    let app = common::make_app(mock);

    let body = download_body("not-a-url", "mp4", "video");
    let req = Request::post("/api/downloads")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(body))
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();

    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    let bytes = resp.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(json["code"], "VALIDATION_ERROR");
}

#[tokio::test]
async fn download_empty_format_returns_400() {
    let mock = common::MockGrpcClient::builder().build();
    let app = common::make_app(mock);

    let body = download_body(VALID_LINK, "", "video");
    let req = Request::post("/api/downloads")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(body))
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();

    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    let bytes = resp.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(json["code"], "VALIDATION_ERROR");
}

#[tokio::test]
async fn download_empty_name_returns_400() {
    let mock = common::MockGrpcClient::builder().build();
    let app = common::make_app(mock);

    let body = download_body(VALID_LINK, "mp4", "");
    let req = Request::post("/api/downloads")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(body))
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();

    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    let bytes = resp.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(json["code"], "VALIDATION_ERROR");
}

// --- SSE stream tests ---

#[tokio::test]
async fn download_progress_event() {
    let mock = common::MockGrpcClient::builder()
        .with_download(|_req| {
            let items = vec![Ok(DownloadResponse {
                payload: Some(download_response::Payload::Progress(DownloadProgress {
                    percent: 42.5,
                    speed: "1.2MB/s".into(),
                    eta: "00:30".into(),
                })),
            })];
            Ok(common::mock_download_stream(items))
        })
        .build();
    let app = common::make_app(mock);

    let body = download_body(VALID_LINK, "mp4", "my-video");
    let req = Request::post("/api/downloads")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(body))
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let bytes = resp.into_body().collect().await.unwrap().to_bytes();
    let text = String::from_utf8(bytes.to_vec()).unwrap();

    assert!(text.contains("event: progress"), "expected event: progress in SSE:\n{text}");
    assert!(text.contains("42.5"), "expected percent in SSE:\n{text}");
    assert!(text.contains("1.2MB/s"), "expected speed in SSE:\n{text}");
}

#[tokio::test]
async fn download_complete_event() {
    let mock = common::MockGrpcClient::builder()
        .with_download(|_req| {
            let items = vec![Ok(DownloadResponse {
                payload: Some(download_response::Payload::Complete(DownloadComplete {
                    output_path: "/tmp/video.mp4".into(),
                    title: "Test".into(),
                    author_name: "Author".into(),
                    format_id: "mp4".into(),
                    format_label: "MP4".into(),
                })),
            })];
            Ok(common::mock_download_stream(items))
        })
        .build();
    let app = common::make_app(mock);

    let body = download_body(VALID_LINK, "mp4", "my-video");
    let req = Request::post("/api/downloads")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(body))
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let bytes = resp.into_body().collect().await.unwrap().to_bytes();
    let text = String::from_utf8(bytes.to_vec()).unwrap();

    assert!(text.contains("event: complete"), "expected event: complete in SSE:\n{text}");
    assert!(text.contains("/tmp/video.mp4"), "expected output_path in SSE:\n{text}");
}

#[tokio::test]
async fn download_error_event() {
    let mock = common::MockGrpcClient::builder()
        .with_download(|_req| {
            let items = vec![Ok(DownloadResponse {
                payload: Some(download_response::Payload::Error(DownloadError {
                    code: "DOWNLOAD_FAILED".into(),
                    message: "ffmpeg crashed".into(),
                })),
            })];
            Ok(common::mock_download_stream(items))
        })
        .build();
    let app = common::make_app(mock);

    let body = download_body(VALID_LINK, "mp4", "my-video");
    let req = Request::post("/api/downloads")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(body))
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let bytes = resp.into_body().collect().await.unwrap().to_bytes();
    let text = String::from_utf8(bytes.to_vec()).unwrap();

    assert!(text.contains("event: error"), "expected event: error in SSE:\n{text}");
    assert!(text.contains("DOWNLOAD_FAILED"), "expected error code in SSE:\n{text}");
    assert!(text.contains("ffmpeg crashed"), "expected error message in SSE:\n{text}");
}

#[tokio::test]
async fn download_grpc_error_returns_503() {
    let mock = common::MockGrpcClient::builder()
        .with_download(|_req| Err(tonic::Status::unavailable("backend down")))
        .build();
    let app = common::make_app(mock);

    let body = download_body(VALID_LINK, "mp4", "my-video");
    let req = Request::post("/api/downloads")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(body))
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();

    assert_eq!(resp.status(), StatusCode::SERVICE_UNAVAILABLE);
    let bytes = resp.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(json["code"], "SERVICE_UNAVAILABLE");
    assert_eq!(json["retryable"], true);
}
