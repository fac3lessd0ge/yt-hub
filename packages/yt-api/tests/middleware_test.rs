mod common;

use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use tower::ServiceExt;

#[tokio::test]
async fn security_headers_present_on_health() {
    let mock = common::MockGrpcClient::builder()
        .with_list_backends(|| Ok(yt_api::proto::ListBackendsResponse { backends: vec![] }))
        .build();
    let app = common::make_full_app(mock);
    let req = Request::get("/health").body(axum::body::Body::empty()).unwrap();
    let resp = app.oneshot(req).await.unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    assert_eq!(resp.headers().get("x-frame-options").unwrap(), "DENY");
    assert_eq!(resp.headers().get("x-content-type-options").unwrap(), "nosniff");
    assert_eq!(resp.headers().get("x-xss-protection").unwrap(), "0");
    assert!(resp.headers().get("content-security-policy").is_some());
}

#[tokio::test]
async fn cors_allows_configured_origin() {
    let mock = common::MockGrpcClient::builder()
        .with_list_backends(|| Ok(yt_api::proto::ListBackendsResponse { backends: vec![] }))
        .build();
    let app = common::make_full_app(mock);
    let req = Request::get("/health")
        .header("Origin", "http://localhost:5173")
        .body(axum::body::Body::empty()).unwrap();
    let resp = app.oneshot(req).await.unwrap();
    assert_eq!(resp.headers().get("access-control-allow-origin").unwrap(), "http://localhost:5173");
}

#[tokio::test]
async fn cors_blocks_unknown_origin() {
    let mock = common::MockGrpcClient::builder()
        .with_list_backends(|| Ok(yt_api::proto::ListBackendsResponse { backends: vec![] }))
        .build();
    let app = common::make_full_app(mock);
    let req = Request::get("/health")
        .header("Origin", "https://evil.com")
        .body(axum::body::Body::empty()).unwrap();
    let resp = app.oneshot(req).await.unwrap();
    assert!(resp.headers().get("access-control-allow-origin").is_none());
}

#[tokio::test]
async fn request_id_header_present() {
    let mock = common::MockGrpcClient::builder()
        .with_list_backends(|| Ok(yt_api::proto::ListBackendsResponse { backends: vec![] }))
        .build();
    let app = common::make_full_app(mock);
    let req = Request::get("/health").body(axum::body::Body::empty()).unwrap();
    let resp = app.oneshot(req).await.unwrap();
    assert!(resp.headers().get("x-request-id").is_some());
    let id = resp.headers().get("x-request-id").unwrap().to_str().unwrap();
    assert!(!id.is_empty());
}

#[tokio::test]
async fn rate_limiting_returns_429_after_burst() {
    let mock = common::MockGrpcClient::builder()
        .with_list_backends(|| Ok(yt_api::proto::ListBackendsResponse { backends: vec![] }))
        .build();

    let governor_layer = yt_api::middleware::rateLimit::build_governor_layer(1, 2);
    let app = common::make_full_app(mock).layer(governor_layer);

    // First 2 requests should succeed (burst_size=2)
    for _ in 0..2 {
        let req = axum::http::Request::get("/health")
            .header("X-Forwarded-For", "1.2.3.4")
            .body(axum::body::Body::empty())
            .unwrap();
        let resp = app.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK, "expected 200 within burst");
    }

    // Third request should be rate limited
    let req = axum::http::Request::get("/health")
        .header("X-Forwarded-For", "1.2.3.4")
        .body(axum::body::Body::empty())
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();

    assert_eq!(resp.status(), StatusCode::TOO_MANY_REQUESTS);

    let bytes = resp.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(json["code"], "RATE_LIMIT_EXCEEDED");
    assert_eq!(json["retryable"], true);
}
