mod common;

use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use tower::ServiceExt;
use yt_api::proto::ListBackendsResponse;

#[tokio::test]
async fn backends_returns_200_with_backends() {
    let mock = common::MockGrpcClient::builder()
        .with_list_backends(|| {
            Ok(ListBackendsResponse {
                backends: vec!["yt-dlp".into(), "ffmpeg".into()],
            })
        })
        .build();
    let app = common::make_app(mock);

    let req = Request::get("/api/backends")
        .body(axum::body::Body::empty())
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = resp.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    let backends = json["backends"].as_array().unwrap();
    assert_eq!(backends.len(), 2);
    assert_eq!(backends[0], "yt-dlp");
    assert_eq!(backends[1], "ffmpeg");
}
