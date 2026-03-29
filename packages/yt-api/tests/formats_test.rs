mod common;

use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use tower::ServiceExt;
use yt_api::proto::{FormatInfo, ListFormatsResponse};

#[tokio::test]
async fn formats_returns_200_with_formats() {
    let mock = common::MockGrpcClient::builder()
        .with_list_formats(|| {
            Ok(ListFormatsResponse {
                formats: vec![
                    FormatInfo {
                        id: "mp4".into(),
                        label: "MP4 Video".into(),
                    },
                    FormatInfo {
                        id: "webm".into(),
                        label: "WebM Video".into(),
                    },
                ],
            })
        })
        .build();
    let app = common::make_app(mock);

    let req = Request::get("/api/formats")
        .body(axum::body::Body::empty())
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();

    assert_eq!(resp.status(), StatusCode::OK);
    let body = resp.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    let formats = json["formats"].as_array().unwrap();
    assert_eq!(formats.len(), 2);
    assert_eq!(formats[0]["id"], "mp4");
    assert_eq!(formats[1]["label"], "WebM Video");
}

#[tokio::test]
async fn formats_grpc_error_returns_500() {
    let mock = common::MockGrpcClient::builder()
        .with_list_formats(|| Err(tonic::Status::internal("db error")))
        .build();
    let app = common::make_app(mock);

    let req = Request::get("/api/formats")
        .body(axum::body::Body::empty())
        .unwrap();
    let resp = app.oneshot(req).await.unwrap();

    assert_eq!(resp.status(), StatusCode::INTERNAL_SERVER_ERROR);
    let body = resp.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["code"], "INTERNAL_ERROR");
}
