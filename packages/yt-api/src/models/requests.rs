use serde::Deserialize;

#[derive(Deserialize)]
pub struct MetadataQuery {
    pub link: String,
}

#[derive(Deserialize)]
pub struct DownloadRequestBody {
    pub link: String,
    pub format: String,
    pub name: String,
    pub destination: Option<String>,
    pub backend: Option<String>,
}

impl From<DownloadRequestBody> for crate::proto::DownloadRequest {
    fn from(body: DownloadRequestBody) -> Self {
        Self {
            link: body.link,
            format: body.format,
            name: body.name,
            destination: body.destination,
            backend: body.backend,
        }
    }
}
