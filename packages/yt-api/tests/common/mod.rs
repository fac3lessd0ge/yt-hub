use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use axum::Router;
use tonic::Streaming;

use yt_api::proto::{
    DownloadRequest, DownloadResponse, GetMetadataResponse, ListBackendsResponse,
    ListFormatsResponse,
};
use yt_api::{AppState, GrpcClientTrait};

type BoxResult<T> = Result<T, tonic::Status>;
type BoxCallback<T> = Box<dyn Fn() -> BoxResult<T> + Send + Sync>;
type BoxAsyncCallback<T> =
    Box<dyn Fn(DownloadRequest) -> BoxResult<T> + Send + Sync>;

#[derive(Clone)]
pub struct MockGrpcClient {
    inner: Arc<MockGrpcClientInner>,
}

struct MockGrpcClientInner {
    get_metadata_fn: BoxCallback<GetMetadataResponse>,
    list_formats_fn: BoxCallback<ListFormatsResponse>,
    list_backends_fn: BoxCallback<ListBackendsResponse>,
    download_fn: BoxAsyncCallback<Streaming<DownloadResponse>>,
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
    download_fn: Option<BoxAsyncCallback<Streaming<DownloadResponse>>>,
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
        f: impl Fn(DownloadRequest) -> BoxResult<Streaming<DownloadResponse>>
            + Send
            + Sync
            + 'static,
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
    async fn get_metadata(&self, _link: &str) -> Result<GetMetadataResponse, tonic::Status> {
        (self.inner.get_metadata_fn)()
    }

    async fn list_formats(&self) -> Result<ListFormatsResponse, tonic::Status> {
        (self.inner.list_formats_fn)()
    }

    async fn list_backends(&self) -> Result<ListBackendsResponse, tonic::Status> {
        (self.inner.list_backends_fn)()
    }

    async fn download(
        &self,
        request: DownloadRequest,
    ) -> Result<Streaming<DownloadResponse>, tonic::Status> {
        (self.inner.download_fn)(request)
    }
}

pub fn make_app(mock: MockGrpcClient) -> Router {
    let state = AppState {
        grpc_client: mock,
        shutting_down: Arc::new(AtomicBool::new(false)),
    };
    yt_api::routes::router::<MockGrpcClient>().with_state(state)
}

pub fn make_app_shutting_down(mock: MockGrpcClient) -> Router {
    let state = AppState {
        grpc_client: mock,
        shutting_down: Arc::new(AtomicBool::new(true)),
    };
    yt_api::routes::router::<MockGrpcClient>().with_state(state)
}
