pub mod error;
pub mod file_delivery;
pub mod grpc;
pub mod internal_protocol;
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

pub use crate::grpc::GrpcClientTrait;
pub use crate::config::FileDeliveryMode;
pub use crate::file_delivery::FileDelivery;

pub mod config;

#[derive(Clone)]
pub struct AppState<C: GrpcClientTrait = grpc::GrpcClient> {
    pub grpc_client: C,
    pub shutting_down: Arc<AtomicBool>,
    pub metrics_handle: PrometheusHandle,
    pub downloads_dir: PathBuf,
    pub file_delivery: Arc<dyn FileDelivery + Send + Sync>,
}
