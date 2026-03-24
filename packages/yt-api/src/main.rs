mod config;
mod error;
mod grpc;
mod models;
mod routes;

pub mod proto {
    tonic::include_proto!("yt_service");
}

use tower_http::cors::CorsLayer;

use crate::config::Config;
use crate::grpc::GrpcClient;

#[derive(Clone)]
pub struct AppState {
    pub grpc_client: GrpcClient,
}

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt::init();

    let config = Config::from_env();

    let grpc_client = GrpcClient::connect(&config.grpc_target)
        .await
        .expect("Failed to connect to gRPC server");

    let state = AppState { grpc_client };

    let app = routes::router()
        .with_state(state)
        .layer(CorsLayer::permissive());

    let addr = config.addr();
    tracing::info!("Listening on {addr}");

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("Failed to bind address");

    axum::serve(listener, app).await.expect("Server error");
}
