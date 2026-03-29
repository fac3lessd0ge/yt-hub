mod config;
pub mod error;
pub mod grpc;
mod middleware;
pub mod models;
pub mod routes;
pub mod validation;

pub mod proto {
    tonic::include_proto!("yt_service");
}

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use metrics_exporter_prometheus::PrometheusHandle;
use tokio::signal;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{EnvFilter, fmt};

use crate::config::Config;
use crate::grpc::GrpcClient;
pub use crate::grpc::GrpcClientTrait;

#[derive(Clone)]
pub struct AppState<C: GrpcClientTrait = GrpcClient> {
    pub grpc_client: C,
    pub shutting_down: Arc<AtomicBool>,
    pub metrics_handle: PrometheusHandle,
}

async fn shutdown_signal(shutting_down: Arc<AtomicBool>) {
    let ctrl_c = async {
        match signal::ctrl_c().await {
            Ok(()) => {}
            Err(e) => {
                tracing::error!("Failed to install Ctrl+C handler: {e}");
                std::process::exit(1);
            }
        }
    };

    #[cfg(unix)]
    let terminate = async {
        match signal::unix::signal(signal::unix::SignalKind::terminate()) {
            Ok(mut sig) => {
                sig.recv().await;
            }
            Err(e) => {
                tracing::error!("Failed to install SIGTERM handler: {e}");
                std::process::exit(1);
            }
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!("Shutdown signal received, starting graceful shutdown");
    shutting_down.store(true, Ordering::SeqCst);
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    let filter = EnvFilter::try_from_env("RUST_LOG")
        .or_else(|_| EnvFilter::try_from_env("LOG_LEVEL"))
        .unwrap_or_else(|_| EnvFilter::new("info"));
    fmt().json().with_env_filter(filter).with_target(true).with_current_span(true).init();

    let config = Config::from_env();

    let grpc_client = match GrpcClient::connect(&config.grpc_target).await {
        Ok(client) => client,
        Err(e) => {
            tracing::error!("Failed to connect to gRPC server: {e}");
            std::process::exit(1);
        }
    };

    let metrics_handle = metrics_exporter_prometheus::PrometheusBuilder::new()
        .install_recorder()
        .expect("Failed to install Prometheus recorder");

    // Spawn periodic upkeep for the metrics recorder
    let upkeep_handle = metrics_handle.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            upkeep_handle.run_upkeep();
        }
    });

    let shutting_down = Arc::new(AtomicBool::new(false));

    let state = AppState {
        grpc_client,
        shutting_down: Arc::clone(&shutting_down),
        metrics_handle,
    };

    let api_routes = routes::router()
        .with_state(state.clone())
        .layer(axum::middleware::from_fn(middleware::metrics::metrics_middleware))
        .layer(TraceLayer::new_for_http())
        .layer(axum::middleware::from_fn(middleware::request_id::request_id_middleware));

    let app = api_routes
        .merge(routes::metrics_router().with_state(state))
        .layer(CorsLayer::permissive());

    let addr = config.addr();
    tracing::info!("Listening on {addr}");

    let listener = match tokio::net::TcpListener::bind(&addr).await {
        Ok(l) => l,
        Err(e) => {
            tracing::error!("Failed to bind address {addr}: {e}");
            std::process::exit(1);
        }
    };

    match axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal(shutting_down))
        .await
    {
        Ok(()) => {}
        Err(e) => {
            tracing::error!("Server error: {e}");
            std::process::exit(1);
        }
    }

    tracing::info!("Server shut down gracefully");
}
