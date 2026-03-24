use std::env;

pub struct Config {
    pub host: String,
    pub port: u16,
    pub grpc_target: String,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            host: env::var("YT_API_HOST").unwrap_or_else(|_| "0.0.0.0".into()),
            port: env::var("YT_API_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(3000),
            grpc_target: env::var("GRPC_TARGET")
                .unwrap_or_else(|_| "http://localhost:50051".into()),
        }
    }

    pub fn addr(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }
}
