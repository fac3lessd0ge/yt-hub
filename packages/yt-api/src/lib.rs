pub mod error;
pub mod grpc;
pub mod middleware;
pub mod models;
pub mod routes;
pub mod validation;

pub mod proto {
    tonic::include_proto!("yt_service");
}

use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use metrics_exporter_prometheus::PrometheusHandle;

pub use crate::grpc::GrpcClientTrait;

#[derive(Clone)]
pub struct AppState<C: GrpcClientTrait = grpc::GrpcClient> {
    pub grpc_client: C,
    pub shutting_down: Arc<AtomicBool>,
    pub metrics_handle: PrometheusHandle,
    pub downloads_dir: PathBuf,
}
