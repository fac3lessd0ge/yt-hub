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
    tracing_subscriber::fmt::init();

    let config = Config::from_env();

    let grpc_client = match GrpcClient::connect(&config.grpc_target).await {
        Ok(client) => client,
        Err(e) => {
            tracing::error!("Failed to connect to gRPC server: {e}");
            std::process::exit(1);
        }
    };

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
