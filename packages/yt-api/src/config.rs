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

fn default_max_body_size_bytes() -> usize {
    1_048_576
}

fn default_streaming_timeout_secs() -> u64 {
    600
}

fn default_rate_limit_rpm() -> u32 {
    30
}

fn default_download_dir() -> String {
    "/home/appuser/Downloads/yt-downloader".into()
}

/// Intermediate struct used by envy for env-var deserialization.
/// `allowed_origins` is handled manually after parsing.
#[derive(Deserialize)]
struct RawConfig {
    #[serde(default = "default_host")]
    yt_api_host: String,

    #[serde(default = "default_port")]
    yt_api_port: u16,

    #[serde(default = "default_grpc_target")]
    grpc_target: String,

    #[serde(default = "default_log_level")]
    log_level: String,

    #[serde(default = "default_request_timeout_ms")]
    request_timeout_ms: u64,

    #[serde(default = "default_streaming_timeout_secs")]
    streaming_timeout_secs: u64,

    #[serde(default = "default_max_body_size_bytes")]
    max_body_size_bytes: usize,

    #[serde(default = "default_rate_limit_rpm")]
    rate_limit_rpm: u32,

    #[serde(default = "default_download_dir")]
    download_dir: String,
}

pub struct Config {
    pub yt_api_host: String,
    pub yt_api_port: u16,
    pub grpc_target: String,
    pub log_level: String,
    pub request_timeout_ms: u64,
    pub streaming_timeout_secs: u64,
    pub max_body_size_bytes: usize,
    pub rate_limit_rpm: u32,
    pub allowed_origins: Vec<String>,
    pub download_dir: std::path::PathBuf,
}

fn default_allowed_origins() -> Vec<String> {
    vec![
        "http://localhost:5173".to_string(),
        "http://localhost:3000".to_string(),
    ]
}

fn parse_allowed_origins() -> Vec<String> {
    match env::var("ALLOWED_ORIGINS") {
        Ok(val) if !val.trim().is_empty() => {
            val.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect()
        }
        _ => default_allowed_origins(),
    }
}

impl Config {
    pub fn from_env() -> Self {
        let raw: RawConfig = envy::from_env().unwrap_or_else(|err| {
            tracing::warn!("Failed to parse config from env with envy ({err}), falling back to manual parsing");
            RawConfig {
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
                streaming_timeout_secs: env::var("STREAMING_TIMEOUT_SECS")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or_else(default_streaming_timeout_secs),
                max_body_size_bytes: env::var("MAX_BODY_SIZE_BYTES")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or_else(default_max_body_size_bytes),
                rate_limit_rpm: env::var("RATE_LIMIT_RPM")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or_else(default_rate_limit_rpm),
                download_dir: env::var("DOWNLOAD_DIR").unwrap_or_else(|_| default_download_dir()),
            }
        });

        let config = Self {
            yt_api_host: raw.yt_api_host,
            yt_api_port: raw.yt_api_port,
            grpc_target: raw.grpc_target,
            log_level: raw.log_level,
            request_timeout_ms: raw.request_timeout_ms,
            streaming_timeout_secs: raw.streaming_timeout_secs,
            max_body_size_bytes: raw.max_body_size_bytes,
            rate_limit_rpm: raw.rate_limit_rpm,
            allowed_origins: parse_allowed_origins(),
            download_dir: std::path::PathBuf::from(raw.download_dir),
        };

        config.validate();

        tracing::info!(
            host = %config.yt_api_host,
            port = config.yt_api_port,
            grpc_target = %config.grpc_target,
            log_level = %config.log_level,
            request_timeout_ms = config.request_timeout_ms,
            streaming_timeout_secs = config.streaming_timeout_secs,
            max_body_size_bytes = config.max_body_size_bytes,
            rate_limit_rpm = config.rate_limit_rpm,
            download_dir = %config.download_dir.display(),
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

    pub fn governor_period_secs(&self) -> u64 {
        60u64 / (self.rate_limit_rpm as u64).max(1)
    }
}
