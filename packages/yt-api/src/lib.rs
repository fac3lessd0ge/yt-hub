pub mod error;
pub mod grpc;
pub mod middleware;
pub mod models;
pub mod routes;
pub mod validation;

pub mod proto {
    tonic::include_proto!("yt_hub.v1");
}

use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use metrics_exporter_prometheus::PrometheusHandle;
use reqwest::Client as HttpClient;

pub use crate::grpc::GrpcClientTrait;
pub use crate::config::FileDeliveryMode;

pub mod config;

#[derive(Clone)]
pub struct AppState<C: GrpcClientTrait = grpc::GrpcClient> {
    pub grpc_client: C,
    pub shutting_down: Arc<AtomicBool>,
    pub metrics_handle: PrometheusHandle,
    pub downloads_dir: PathBuf,
    pub file_delivery_mode: FileDeliveryMode,
    pub internal_file_base_url: Option<String>,
    pub internal_api_key: Option<String>,
    pub http_client: HttpClient,
}
