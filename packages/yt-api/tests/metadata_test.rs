mod common;

use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use tower::ServiceExt;
use yt_api::proto::GetMetadataResponse;

#[tokio::test]
async fn metadata_valid_url_returns_200() {
    let mock = common::MockGrpcClient::builder()
        .with_get_metadata(|| {
            Ok(GetMetadataResponse {
                title: "Test Video".into(),
                author_name: "Test Author".into(),
            })
        })
        .build();
    let app = common::make_app(mock);

    let req = Request::get("/api/metadata?link=https://www.youtube.com/watch?v=abc123")
        .body(axum::body::Body::empty())
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = resp.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["title"], "Test Video");
    assert_eq!(json["author_name"], "Test Author");
}

#[tokio::test]
async fn metadata_missing_link_returns_400() {
    let mock = common::MockGrpcClient::builder().build();
    let app = common::make_app(mock);

    let req = Request::get("/api/metadata")
        .body(axum::body::Body::empty())
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();

    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn metadata_invalid_url_returns_400_validation_error() {
    let mock = common::MockGrpcClient::builder().build();
    let app = common::make_app(mock);

    let req = Request::get("/api/metadata?link=not-a-url")
        .body(axum::body::Body::empty())
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();

    assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    let body = resp.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["code"], "VALIDATION_ERROR");
}

#[tokio::test]
async fn metadata_grpc_not_found_returns_404() {
    let mock = common::MockGrpcClient::builder()
        .with_get_metadata(|| Err(Box::new(tonic::Status::not_found("video not found"))))
        .build();
    let app = common::make_app(mock);

    let req = Request::get("/api/metadata?link=https://www.youtube.com/watch?v=missing")
        .body(axum::body::Body::empty())
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();

    assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    let body = resp.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["code"], "VIDEO_NOT_FOUND");
}
