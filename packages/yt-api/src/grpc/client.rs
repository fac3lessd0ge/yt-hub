use std::pin::Pin;
use std::time::Duration;

use tokio_stream::Stream;
use tonic::transport::Channel;

use crate::proto::yt_service_client::YtServiceClient;
use crate::proto::{
    DownloadRequest, DownloadResponse, GetMetadataRequest, GetMetadataResponse,
    ListBackendsRequest, ListBackendsResponse, ListFormatsRequest, ListFormatsResponse,
};

const GRPC_CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const UNARY_RPC_TIMEOUT: Duration = Duration::from_secs(30);
const STREAMING_RPC_TIMEOUT: Duration = Duration::from_secs(600);

/// A type-erased stream of download responses, usable both with tonic::Streaming and test mocks.
pub type DownloadStream =
    Pin<Box<dyn Stream<Item = Result<DownloadResponse, tonic::Status>> + Send>>;

#[async_trait::async_trait]
pub trait GrpcClientTrait: Clone + Send + Sync + 'static {
    async fn get_metadata(
        &self,
        link: &str,
        request_id: Option<&str>,
    ) -> Result<GetMetadataResponse, tonic::Status>;
    async fn list_formats(
        &self,
        request_id: Option<&str>,
    ) -> Result<ListFormatsResponse, tonic::Status>;
    async fn list_backends(
        &self,
        request_id: Option<&str>,
    ) -> Result<ListBackendsResponse, tonic::Status>;
    async fn download(
        &self,
        request: DownloadRequest,
        request_id: Option<&str>,
    ) -> Result<DownloadStream, tonic::Status>;
}

#[derive(Clone)]
pub struct GrpcClient {
    inner: YtServiceClient<Channel>,
}

fn record_grpc_call(method: &str, outcome: &str) {
    metrics::counter!("grpc_calls_total", "method" => method.to_string(), "outcome" => outcome.to_string()).increment(1);
}

fn inject_request_id<T>(req: &mut tonic::Request<T>, request_id: Option<&str>) {
    if let Some(id) = request_id {
        if let Ok(val) = id.parse() {
            req.metadata_mut().insert("x-request-id", val);
        }
    }
}

macro_rules! grpc_call {
    ($self:expr, $method:expr, $request_body:expr, $request_id:expr, $timeout:expr, $call:ident) => {{
        let mut request = tonic::Request::new($request_body);
        inject_request_id(&mut request, $request_id);
        request.set_timeout($timeout);
        let start = std::time::Instant::now();
        let result = $self.inner.clone().$call(request).await.map(|r| r.into_inner());
        let duration_ms = start.elapsed().as_millis();
        match &result {
            Ok(_) => {
                record_grpc_call($method, "ok");
                tracing::info!(grpc_method = $method, duration_ms, outcome = "ok", "gRPC call completed");
            }
            Err(status) => {
                record_grpc_call($method, "error");
                tracing::warn!(grpc_method = $method, duration_ms, outcome = "error", grpc_code = %status.code(), "gRPC call failed");
            }
        }
        result
    }};
}

impl GrpcClient {
    pub async fn connect(addr: &str) -> Result<Self, tonic::transport::Error> {
        let channel = tonic::transport::Endpoint::from_shared(addr.to_string())
            .expect("invalid gRPC address")
            .connect_timeout(GRPC_CONNECT_TIMEOUT)
            .connect()
            .await?;
        let inner = YtServiceClient::new(channel);
        Ok(Self { inner })
    }
}

#[async_trait::async_trait]
impl GrpcClientTrait for GrpcClient {
    async fn get_metadata(
        &self,
        link: &str,
        request_id: Option<&str>,
    ) -> Result<GetMetadataResponse, tonic::Status> {
        grpc_call!(self, "get_metadata", GetMetadataRequest { link: link.to_string() }, request_id, UNARY_RPC_TIMEOUT, get_metadata)
    }

    async fn list_formats(
        &self,
        request_id: Option<&str>,
    ) -> Result<ListFormatsResponse, tonic::Status> {
        grpc_call!(self, "list_formats", ListFormatsRequest {}, request_id, UNARY_RPC_TIMEOUT, list_formats)
    }

    async fn list_backends(
        &self,
        request_id: Option<&str>,
    ) -> Result<ListBackendsResponse, tonic::Status> {
        grpc_call!(self, "list_backends", ListBackendsRequest {}, request_id, UNARY_RPC_TIMEOUT, list_backends)
    }

    async fn download(
        &self,
        download_req: DownloadRequest,
        request_id: Option<&str>,
    ) -> Result<DownloadStream, tonic::Status> {
        let mut request = tonic::Request::new(download_req);
        inject_request_id(&mut request, request_id);
        request.set_timeout(STREAMING_RPC_TIMEOUT);
        let start = std::time::Instant::now();
        let result = self
            .inner
            .clone()
            .download(request)
            .await
            .map(|r| Box::pin(r.into_inner()) as DownloadStream);
        let duration_ms = start.elapsed().as_millis();
        match &result {
            Ok(_) => {
                record_grpc_call("download", "ok");
                tracing::info!(grpc_method = "download", duration_ms, outcome = "ok", "gRPC call completed");
            }
            Err(status) => {
                record_grpc_call("download", "error");
                tracing::warn!(grpc_method = "download", duration_ms, outcome = "error", grpc_code = %status.code(), "gRPC call failed");
            }
        }
        result
    }
}
