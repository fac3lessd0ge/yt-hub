use std::pin::Pin;

use tokio_stream::Stream;
use tonic::transport::Channel;

use crate::proto::yt_service_client::YtServiceClient;
use crate::proto::{
    DownloadRequest, DownloadResponse, GetMetadataRequest, GetMetadataResponse,
    ListBackendsRequest, ListBackendsResponse, ListFormatsRequest, ListFormatsResponse,
};

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

impl GrpcClient {
    pub async fn connect(addr: &str) -> Result<Self, tonic::transport::Error> {
        let inner = YtServiceClient::connect(addr.to_string()).await?;
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
        let mut request = tonic::Request::new(GetMetadataRequest {
            link: link.to_string(),
        });
        inject_request_id(&mut request, request_id);
        let start = std::time::Instant::now();
        let result = self.inner.clone().get_metadata(request).await.map(|r| r.into_inner());
        let duration_ms = start.elapsed().as_millis();
        match &result {
            Ok(_) => {
                record_grpc_call("get_metadata", "ok");
                tracing::info!(grpc_method = "get_metadata", duration_ms, outcome = "ok", "gRPC call completed");
            }
            Err(status) => {
                record_grpc_call("get_metadata", "error");
                tracing::warn!(grpc_method = "get_metadata", duration_ms, outcome = "error", grpc_code = %status.code(), "gRPC call failed");
            }
        }
        result
    }

    async fn list_formats(
        &self,
        request_id: Option<&str>,
    ) -> Result<ListFormatsResponse, tonic::Status> {
        let mut request = tonic::Request::new(ListFormatsRequest {});
        inject_request_id(&mut request, request_id);
        let start = std::time::Instant::now();
        let result = self.inner.clone().list_formats(request).await.map(|r| r.into_inner());
        let duration_ms = start.elapsed().as_millis();
        match &result {
            Ok(_) => {
                record_grpc_call("list_formats", "ok");
                tracing::info!(grpc_method = "list_formats", duration_ms, outcome = "ok", "gRPC call completed");
            }
            Err(status) => {
                record_grpc_call("list_formats", "error");
                tracing::warn!(grpc_method = "list_formats", duration_ms, outcome = "error", grpc_code = %status.code(), "gRPC call failed");
            }
        }
        result
    }

    async fn list_backends(
        &self,
        request_id: Option<&str>,
    ) -> Result<ListBackendsResponse, tonic::Status> {
        let mut request = tonic::Request::new(ListBackendsRequest {});
        inject_request_id(&mut request, request_id);
        let start = std::time::Instant::now();
        let result = self.inner.clone().list_backends(request).await.map(|r| r.into_inner());
        let duration_ms = start.elapsed().as_millis();
        match &result {
            Ok(_) => {
                record_grpc_call("list_backends", "ok");
                tracing::info!(grpc_method = "list_backends", duration_ms, outcome = "ok", "gRPC call completed");
            }
            Err(status) => {
                record_grpc_call("list_backends", "error");
                tracing::warn!(grpc_method = "list_backends", duration_ms, outcome = "error", grpc_code = %status.code(), "gRPC call failed");
            }
        }
        result
    }

    async fn download(
        &self,
        download_req: DownloadRequest,
        request_id: Option<&str>,
    ) -> Result<DownloadStream, tonic::Status> {
        let mut request = tonic::Request::new(download_req);
        inject_request_id(&mut request, request_id);
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
