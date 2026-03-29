use serde::Serialize;

use crate::proto;

#[derive(Serialize)]
pub struct MetadataResponse {
    pub title: String,
    pub author_name: String,
}

impl From<proto::GetMetadataResponse> for MetadataResponse {
    fn from(r: proto::GetMetadataResponse) -> Self {
        Self {
            title: r.title,
            author_name: r.author_name,
        }
    }
}

#[derive(Serialize)]
pub struct FormatInfo {
    pub id: String,
    pub label: String,
}

impl From<proto::FormatInfo> for FormatInfo {
    fn from(f: proto::FormatInfo) -> Self {
        Self {
            id: f.id,
            label: f.label,
        }
    }
}

#[derive(Serialize)]
pub struct FormatsResponse {
    pub formats: Vec<FormatInfo>,
}

impl From<proto::ListFormatsResponse> for FormatsResponse {
    fn from(r: proto::ListFormatsResponse) -> Self {
        Self {
            formats: r.formats.into_iter().map(FormatInfo::from).collect(),
        }
    }
}

#[derive(Serialize)]
pub struct BackendsResponse {
    pub backends: Vec<String>,
}

impl From<proto::ListBackendsResponse> for BackendsResponse {
    fn from(r: proto::ListBackendsResponse) -> Self {
        Self {
            backends: r.backends,
        }
    }
}

#[derive(Serialize)]
pub struct DownloadProgress {
    pub percent: f32,
    pub speed: String,
    pub eta: String,
}

#[derive(Serialize)]
pub struct DownloadComplete {
    pub output_path: String,
    pub title: String,
    pub author_name: String,
    pub format_id: String,
    pub format_label: String,
}

#[derive(Serialize)]
#[allow(dead_code)]
pub struct DownloadError {
    pub code: String,
    pub message: String,
}
