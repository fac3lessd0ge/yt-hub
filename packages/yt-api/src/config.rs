use serde::Deserialize;
use std::env;

fn default_host() -> String {
    "0.0.0.0".into()
}

fn default_port() -> u16 {
    3000
}

fn default_grpc_target() -> String {
    "http://localhost:50051".into()
}

fn default_log_level() -> String {
    "info".into()
}

fn default_request_timeout_ms() -> u64 {
    30000
}

#[derive(Deserialize)]
pub struct Config {
    #[serde(default = "default_host")]
    pub yt_api_host: String,

    #[serde(default = "default_port")]
    pub yt_api_port: u16,

    #[serde(default = "default_grpc_target")]
    pub grpc_target: String,

    #[serde(default = "default_log_level")]
    pub log_level: String,

    #[serde(default = "default_request_timeout_ms")]
    pub request_timeout_ms: u64,
}

impl Config {
    pub fn from_env() -> Self {
        let config: Self = envy::from_env().unwrap_or_else(|err| {
            tracing::warn!("Failed to parse config from env with envy ({err}), falling back to manual parsing");
            Self {
                yt_api_host: env::var("YT_API_HOST").unwrap_or_else(|_| default_host()),
                yt_api_port: env::var("YT_API_PORT")
                    .ok()
                    .and_then(|p| p.parse().ok())
                    .unwrap_or_else(default_port),
                grpc_target: env::var("GRPC_TARGET").unwrap_or_else(|_| default_grpc_target()),
                log_level: env::var("LOG_LEVEL").unwrap_or_else(|_| default_log_level()),
                request_timeout_ms: env::var("REQUEST_TIMEOUT_MS")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or_else(default_request_timeout_ms),
            }
        });

        config.validate();

        tracing::info!(
            host = %config.yt_api_host,
            port = config.yt_api_port,
            grpc_target = %config.grpc_target,
            log_level = %config.log_level,
            request_timeout_ms = config.request_timeout_ms,
            "Resolved yt-api config"
        );

        config
    }

    fn validate(&self) {
        assert!(
            self.yt_api_port >= 1,
            "YT_API_PORT must be between 1 and 65535, got {}",
            self.yt_api_port
        );

        assert!(
            self.grpc_target.starts_with("http://") || self.grpc_target.starts_with("https://"),
            "GRPC_TARGET must start with http:// or https://, got '{}'",
            self.grpc_target
        );
    }

    pub fn addr(&self) -> String {
        format!("{}:{}", self.yt_api_host, self.yt_api_port)
    }
}
