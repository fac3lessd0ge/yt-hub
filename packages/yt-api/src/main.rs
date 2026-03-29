mod config;
mod error;
mod grpc;
mod models;
mod routes;
mod validation;

pub mod proto {
    tonic::include_proto!("yt_service");
}

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use tokio::signal;
use tower_http::cors::CorsLayer;

use crate::config::Config;
use crate::grpc::GrpcClient;

#[derive(Clone)]
pub struct AppState {
    pub grpc_client: GrpcClient,
    pub shutting_down: Arc<AtomicBool>,
}

async fn shutdown_signal(shutting_down: Arc<AtomicBool>) {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("Failed to install SIGTERM handler")
            .recv()
            .await;
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
    tracing_subscriber::fmt::init();

    let config = Config::from_env();

    let grpc_client = GrpcClient::connect(&config.grpc_target)
        .await
        .expect("Failed to connect to gRPC server");

    let shutting_down = Arc::new(AtomicBool::new(false));

    let state = AppState {
        grpc_client,
        shutting_down: Arc::clone(&shutting_down),
    };

    let app = routes::router()
        .with_state(state)
        .layer(CorsLayer::permissive());

    let addr = config.addr();
    tracing::info!("Listening on {addr}");

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("Failed to bind address");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal(shutting_down))
        .await
        .expect("Server error");

    tracing::info!("Server shut down gracefully");
}
