use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

use axum::BoxError;
use axum::Json;
use axum::http::{HeaderValue, Method, StatusCode, header};
use axum::response::IntoResponse;
use tokio::signal;
use tower::ServiceBuilder;
use tower::timeout::TimeoutLayer;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{EnvFilter, fmt};

use yt_api::grpc::GrpcClient;
use yt_api::AppState;

mod config;
use config::Config;

async fn handle_timeout_error(err: BoxError) -> impl IntoResponse {
    if err.is::<tower::timeout::error::Elapsed>() {
        (
            StatusCode::REQUEST_TIMEOUT,
            Json(serde_json::json!({
                "code": "REQUEST_TIMEOUT",
                "message": "Request timed out",
                "retryable": true
            })),
        )
    } else {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "code": "INTERNAL_ERROR",
                "message": "Internal server error",
                "retryable": false
            })),
        )
    }
}

fn build_cors_layer(config: &Config) -> CorsLayer {
    let origins: Vec<HeaderValue> = config
        .allowed_origins
        .iter()
        .filter_map(|o| o.parse::<HeaderValue>().ok())
        .collect();

    CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([
            header::CONTENT_TYPE,
            header::ACCEPT,
        ])
        .allow_credentials(false)
        .max_age(std::time::Duration::from_secs(3600))
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

    let regular_timeout = Duration::from_millis(config.request_timeout_ms);
    let streaming_timeout = Duration::from_secs(600);

    let regular_routes = yt_api::routes::regular_routes()
        .with_state(state.clone())
        .layer(
            ServiceBuilder::new()
                .layer(axum::extract::DefaultBodyLimit::max(config.max_body_size_bytes))
                .layer(axum::middleware::from_fn(yt_api::middleware::metrics::metrics_middleware))
                .layer(TraceLayer::new_for_http())
                .layer(axum::middleware::from_fn(yt_api::middleware::request_id::request_id_middleware))
                .layer(axum::error_handling::HandleErrorLayer::new(handle_timeout_error))
                .layer(TimeoutLayer::new(regular_timeout)),
        );

    let streaming_routes = yt_api::routes::streaming_routes()
        .with_state(state.clone())
        .layer(
            ServiceBuilder::new()
                .layer(axum::extract::DefaultBodyLimit::max(config.max_body_size_bytes))
                .layer(axum::middleware::from_fn(yt_api::middleware::metrics::metrics_middleware))
                .layer(TraceLayer::new_for_http())
                .layer(axum::middleware::from_fn(yt_api::middleware::request_id::request_id_middleware))
                .layer(axum::error_handling::HandleErrorLayer::new(handle_timeout_error))
                .layer(TimeoutLayer::new(streaming_timeout)),
        );

    let cors_layer = build_cors_layer(&config);

    let app = regular_routes
        .merge(streaming_routes)
        .merge(yt_api::routes::metrics_router().with_state(state))
        .layer(cors_layer);

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
