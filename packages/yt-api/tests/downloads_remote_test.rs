//! Remote file delivery (VM1 -> VM2 internal HTTP) integration tests.

use std::time::Duration;

use axum::http::StatusCode;
use http_body_util::BodyExt;
use mockito::Server;
use percent_encoding::{NON_ALPHANUMERIC, utf8_percent_encode};
use yt_api::error::AppError;
use yt_api::file_delivery::FileDelivery;
use yt_api::file_delivery::RemoteFileDelivery;

fn test_client() -> reqwest::Client {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(2))
        .timeout(Duration::from_secs(10))
        .build()
        .unwrap()
}

#[tokio::test]
async fn remote_happy_path_streams_body_and_headers() {
    let mut server = Server::new_async().await;
    let enc = utf8_percent_encode("track.mp3", NON_ALPHANUMERIC).to_string();
    let expected_path = format!("/internal/files/{enc}");
    let mock = server
        .mock("GET", expected_path.as_str())
        .match_header("x-internal-api-key", "sixteencharslong")
        .with_status(200)
        .with_header("content-type", "audio/mpeg")
        .with_header("content-disposition", "attachment; filename=\"track.mp3\"")
        .with_body(b"hello-bytes")
        .create_async()
        .await;

    let base = server.url();
    let delivery = RemoteFileDelivery::new(
        test_client(),
        base,
        "sixteencharslong".to_string(),
    );
    let resp = delivery.serve_file("track.mp3").await.unwrap();
    assert_eq!(resp.status(), StatusCode::OK);
    let body = resp.into_body().collect().await.unwrap().to_bytes();
    assert_eq!(body.as_ref(), b"hello-bytes");
    mock.assert_async().await;
}

#[tokio::test]
async fn remote_upstream_404_maps_to_not_found() {
    let mut server = Server::new_async().await;
    let mock = server
        .mock("GET", mockito::Matcher::Any)
        .with_status(404)
        .create_async()
        .await;

    let delivery = RemoteFileDelivery::new(
        test_client(),
        server.url(),
        "sixteencharslong".to_string(),
    );
    let err = delivery
        .serve_file("missing.mp3")
        .await
        .unwrap_err();
    match err {
        AppError::NotFound(m) => assert!(m.contains("missing.mp3")),
        _ => panic!("expected NotFound, got {err:?}"),
    }
    mock.assert_async().await;
}

#[tokio::test]
async fn remote_upstream_5xx_maps_to_upstream_unavailable() {
    let mut server = Server::new_async().await;
    let mock = server
        .mock("GET", mockito::Matcher::Any)
        .with_status(503)
        .create_async()
        .await;

    let delivery = RemoteFileDelivery::new(
        test_client(),
        server.url(),
        "sixteencharslong".to_string(),
    );
    let err = delivery.serve_file("x.mp3").await.unwrap_err();
    match err {
        AppError::UpstreamUnavailable(_) => {}
        _ => panic!("expected UpstreamUnavailable, got {err:?}"),
    }
    mock.assert_async().await;
}

#[tokio::test]
async fn remote_percent_encodes_filename_in_path() {
    let mut server = Server::new_async().await;
    let name = "hello мир.mp3";
    let enc = utf8_percent_encode(name, NON_ALPHANUMERIC).to_string();
    let expected_path = format!("/internal/files/{enc}");

    let mock = server
        .mock("GET", expected_path.as_str())
        .match_header("x-internal-api-key", "sixteencharslong")
        .with_status(200)
        .with_body(b"ok")
        .create_async()
        .await;

    let delivery = RemoteFileDelivery::new(
        test_client(),
        server.url(),
        "sixteencharslong".to_string(),
    );
    delivery.serve_file(name).await.unwrap();
    mock.assert_async().await;
}

#[tokio::test]
async fn remote_connection_refused_maps_to_upstream_unavailable() {
    let delivery = RemoteFileDelivery::new(
        test_client(),
        "http://127.0.0.1:1".to_string(),
        "sixteencharslong".to_string(),
    );
    let err = delivery.serve_file("x.mp3").await.unwrap_err();
    match err {
        AppError::UpstreamUnavailable(_) => {}
        _ => panic!("expected UpstreamUnavailable, got {err:?}"),
    }
}
