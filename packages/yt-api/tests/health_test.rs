mod common;

use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use tower::ServiceExt;

#[tokio::test]
async fn health_ok_when_not_shutting_down() {
    let mock = common::MockGrpcClient::builder().build();
    let app = common::make_app(mock);

    let req = Request::get("/health").body(axum::body::Body::empty()).unwrap();
    let resp = app.oneshot(req).await.unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = resp.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["status"], "ok");
}

#[tokio::test]
async fn health_503_when_shutting_down() {
    let mock = common::MockGrpcClient::builder().build();
    let app = common::make_app_shutting_down(mock);

    let req = Request::get("/health").body(axum::body::Body::empty()).unwrap();
    let resp = app.oneshot(req).await.unwrap();

    assert_eq!(resp.status(), StatusCode::SERVICE_UNAVAILABLE);
    let body = resp.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["status"], "shutting_down");
}

#[tokio::test]
async fn health_deep_ok_when_grpc_reachable() {
    let mock = common::MockGrpcClient::builder()
        .with_list_backends(|| {
            Ok(yt_api::proto::ListBackendsResponse {
                backends: vec!["yt-dlp".to_string()],
            })
        })
        .build();
    let app = common::make_app(mock);

    let req = Request::get("/health?deep=true")
        .body(axum::body::Body::empty())
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = resp.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["status"], "ok");
    assert_eq!(json["grpc"], "connected");
}

#[tokio::test]
async fn health_deep_503_when_grpc_unreachable() {
    let mock = common::MockGrpcClient::builder()
        .with_list_backends(|| Err(tonic::Status::unavailable("connection refused")))
        .build();
    let app = common::make_app(mock);

    let req = Request::get("/health?deep=true")
        .body(axum::body::Body::empty())
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();

    assert_eq!(resp.status(), StatusCode::SERVICE_UNAVAILABLE);
    let body = resp.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["status"], "degraded");
}
