#![allow(dead_code)]

use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use axum::Router;

use yt_api::grpc::DownloadStream;
use yt_api::proto::{
    DownloadRequest, DownloadResponse, GetMetadataResponse, ListBackendsResponse,
    ListFormatsResponse,
};
use yt_api::{AppState, GrpcClientTrait};

type BoxResult<T> = Result<T, tonic::Status>;
type BoxCallback<T> = Box<dyn Fn() -> BoxResult<T> + Send + Sync>;
type DownloadCallback = Box<dyn Fn(DownloadRequest) -> BoxResult<DownloadStream> + Send + Sync>;

#[derive(Clone)]
pub struct MockGrpcClient {
    inner: Arc<MockGrpcClientInner>,
}

struct MockGrpcClientInner {
    get_metadata_fn: BoxCallback<GetMetadataResponse>,
    list_formats_fn: BoxCallback<ListFormatsResponse>,
    list_backends_fn: BoxCallback<ListBackendsResponse>,
    download_fn: DownloadCallback,
}

impl MockGrpcClient {
    pub fn builder() -> MockGrpcClientBuilder {
        MockGrpcClientBuilder::default()
    }
}

pub struct MockGrpcClientBuilder {
    get_metadata_fn: Option<BoxCallback<GetMetadataResponse>>,
    list_formats_fn: Option<BoxCallback<ListFormatsResponse>>,
    list_backends_fn: Option<BoxCallback<ListBackendsResponse>>,
    download_fn: Option<DownloadCallback>,
}

impl Default for MockGrpcClientBuilder {
    fn default() -> Self {
        Self {
            get_metadata_fn: None,
            list_formats_fn: None,
            list_backends_fn: None,
            download_fn: None,
        }
    }
}

impl MockGrpcClientBuilder {
    pub fn with_get_metadata(
        mut self,
        f: impl Fn() -> BoxResult<GetMetadataResponse> + Send + Sync + 'static,
    ) -> Self {
        self.get_metadata_fn = Some(Box::new(f));
        self
    }

    pub fn with_list_formats(
        mut self,
        f: impl Fn() -> BoxResult<ListFormatsResponse> + Send + Sync + 'static,
    ) -> Self {
        self.list_formats_fn = Some(Box::new(f));
        self
    }

    pub fn with_list_backends(
        mut self,
        f: impl Fn() -> BoxResult<ListBackendsResponse> + Send + Sync + 'static,
    ) -> Self {
        self.list_backends_fn = Some(Box::new(f));
        self
    }

    pub fn with_download(
        mut self,
        f: impl Fn(DownloadRequest) -> BoxResult<DownloadStream> + Send + Sync + 'static,
    ) -> Self {
        self.download_fn = Some(Box::new(f));
        self
    }

    pub fn build(self) -> MockGrpcClient {
        MockGrpcClient {
            inner: Arc::new(MockGrpcClientInner {
                get_metadata_fn: self.get_metadata_fn.unwrap_or_else(|| {
                    Box::new(|| {
                        Err(tonic::Status::unimplemented(
                            "get_metadata not configured in mock",
                        ))
                    })
                }),
                list_formats_fn: self.list_formats_fn.unwrap_or_else(|| {
                    Box::new(|| {
                        Err(tonic::Status::unimplemented(
                            "list_formats not configured in mock",
                        ))
                    })
                }),
                list_backends_fn: self.list_backends_fn.unwrap_or_else(|| {
                    Box::new(|| {
                        Err(tonic::Status::unimplemented(
                            "list_backends not configured in mock",
                        ))
                    })
                }),
                download_fn: self.download_fn.unwrap_or_else(|| {
                    Box::new(|_| {
                        Err(tonic::Status::unimplemented(
                            "download not configured in mock",
                        ))
                    })
                }),
            }),
        }
    }
}

#[async_trait::async_trait]
impl GrpcClientTrait for MockGrpcClient {
    async fn get_metadata(
        &self,
        _link: &str,
        _request_id: Option<&str>,
    ) -> Result<GetMetadataResponse, tonic::Status> {
        (self.inner.get_metadata_fn)()
    }

    async fn list_formats(
        &self,
        _request_id: Option<&str>,
    ) -> Result<ListFormatsResponse, tonic::Status> {
        (self.inner.list_formats_fn)()
    }

    async fn list_backends(
        &self,
        _request_id: Option<&str>,
    ) -> Result<ListBackendsResponse, tonic::Status> {
        (self.inner.list_backends_fn)()
    }

    async fn download(
        &self,
        request: DownloadRequest,
        _request_id: Option<&str>,
    ) -> Result<DownloadStream, tonic::Status> {
        (self.inner.download_fn)(request)
    }
}

fn test_metrics_handle() -> metrics_exporter_prometheus::PrometheusHandle {
    metrics_exporter_prometheus::PrometheusBuilder::new()
        .build_recorder()
        .handle()
}

pub fn make_app(mock: MockGrpcClient) -> Router {
    let state = AppState {
        grpc_client: mock,
        shutting_down: Arc::new(AtomicBool::new(false)),
        metrics_handle: test_metrics_handle(),
        downloads_dir: std::env::temp_dir().join("yt-hub-test-downloads"),
    };
    yt_api::routes::router::<MockGrpcClient>()
        .with_state(state)
        .layer(axum::middleware::from_fn(
            yt_api::middleware::request_id::request_id_middleware,
        ))
}

pub fn make_app_shutting_down(mock: MockGrpcClient) -> Router {
    let state = AppState {
        grpc_client: mock,
        shutting_down: Arc::new(AtomicBool::new(true)),
        metrics_handle: test_metrics_handle(),
        downloads_dir: std::env::temp_dir().join("yt-hub-test-downloads"),
    };
    yt_api::routes::router::<MockGrpcClient>()
        .with_state(state)
        .layer(axum::middleware::from_fn(
            yt_api::middleware::request_id::request_id_middleware,
        ))
}

pub fn make_app_with_downloads_dir(mock: MockGrpcClient, downloads_dir: std::path::PathBuf) -> Router {
    let state = AppState {
        grpc_client: mock,
        shutting_down: Arc::new(AtomicBool::new(false)),
        metrics_handle: test_metrics_handle(),
        downloads_dir,
    };
    yt_api::routes::router::<MockGrpcClient>()
        .with_state(state)
        .layer(axum::middleware::from_fn(
            yt_api::middleware::request_id::request_id_middleware,
        ))
}

pub fn make_full_app(mock: MockGrpcClient) -> Router {
    use axum::http::{HeaderValue, Method, header};
    use tower_http::cors::{AllowOrigin, CorsLayer};

    let state = AppState {
        grpc_client: mock,
        shutting_down: Arc::new(AtomicBool::new(false)),
        metrics_handle: test_metrics_handle(),
        downloads_dir: std::env::temp_dir().join("yt-hub-test-downloads"),
    };

    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list([
            "http://localhost:5173".parse::<HeaderValue>().unwrap(),
        ]))
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([header::CONTENT_TYPE, header::ACCEPT])
        .allow_credentials(false)
        .max_age(std::time::Duration::from_secs(3600));

    yt_api::routes::router::<MockGrpcClient>()
        .with_state(state)
        .layer(axum::middleware::from_fn(
            yt_api::middleware::request_id::request_id_middleware,
        ))
        .layer(axum::middleware::from_fn(
            yt_api::middleware::securityHeaders::security_headers_middleware,
        ))
        .layer(cors)
}

/// Helper to create a mock download stream from a vector of responses.
pub fn mock_download_stream(
    items: Vec<Result<DownloadResponse, tonic::Status>>,
) -> DownloadStream {
    Box::pin(tokio_stream::iter(items))
}
