use tonic::transport::Channel;
use tonic::Streaming;

use crate::proto::yt_service_client::YtServiceClient;
use crate::proto::{
    DownloadRequest, DownloadResponse, GetMetadataRequest, GetMetadataResponse,
    ListBackendsRequest, ListBackendsResponse, ListFormatsRequest, ListFormatsResponse,
};

#[derive(Clone)]
pub struct GrpcClient {
    inner: YtServiceClient<Channel>,
}

impl GrpcClient {
    pub async fn connect(addr: &str) -> Result<Self, tonic::transport::Error> {
        let inner = YtServiceClient::connect(addr.to_string()).await?;
        Ok(Self { inner })
    }

    pub async fn get_metadata(&self, link: &str) -> Result<GetMetadataResponse, tonic::Status> {
        let request = GetMetadataRequest {
            link: link.to_string(),
        };
        self.inner
            .clone()
            .get_metadata(request)
            .await
            .map(|r| r.into_inner())
    }

    pub async fn list_formats(&self) -> Result<ListFormatsResponse, tonic::Status> {
        self.inner
            .clone()
            .list_formats(ListFormatsRequest {})
            .await
            .map(|r| r.into_inner())
    }

    pub async fn list_backends(&self) -> Result<ListBackendsResponse, tonic::Status> {
        self.inner
            .clone()
            .list_backends(ListBackendsRequest {})
            .await
            .map(|r| r.into_inner())
    }

    pub async fn download(
        &self,
        request: DownloadRequest,
    ) -> Result<Streaming<DownloadResponse>, tonic::Status> {
        self.inner
            .clone()
            .download(request)
            .await
            .map(|r| r.into_inner())
    }
}
