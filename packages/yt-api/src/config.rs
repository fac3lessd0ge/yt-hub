use serde::Deserialize;
use std::env;
use std::fmt;

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

fn default_file_delivery_mode() -> String {
    "local".into()
}

/// Mirrors `INTERNAL_API_KEY_MIN_LEN` in `packages/yt-service/src/config.ts`.
/// Both sides of the shared-secret contract reject keys shorter than this at startup,
/// so a misconfigured operator gets a loud failure instead of opaque 403s in production.
const INTERNAL_API_KEY_MIN_LEN: usize = 16;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileDeliveryMode {
    Local,
    Remote,
}

impl FileDeliveryMode {
    fn from_env_value(raw: &str) -> Result<Self, String> {
        match raw.trim().to_ascii_lowercase().as_str() {
            "local" => Ok(Self::Local),
            "remote" => Ok(Self::Remote),
            other => Err(format!(
                "FILE_DELIVERY_MODE must be 'local' or 'remote', got '{other}'"
            )),
        }
    }
}

impl fmt::Display for FileDeliveryMode {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Local => write!(f, "local"),
            Self::Remote => write!(f, "remote"),
        }
    }
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

    #[serde(default = "default_file_delivery_mode")]
    file_delivery_mode: String,

    internal_file_base_url: Option<String>,
    internal_api_key: Option<String>,
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
    pub file_delivery_mode: FileDeliveryMode,
    pub internal_file_base_url: Option<String>,
    pub internal_api_key: Option<String>,
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
                file_delivery_mode: env::var("FILE_DELIVERY_MODE")
                    .unwrap_or_else(|_| default_file_delivery_mode()),
                internal_file_base_url: env::var("INTERNAL_FILE_BASE_URL").ok(),
                internal_api_key: env::var("INTERNAL_API_KEY").ok(),
            }
        });

        let file_delivery_mode = match FileDeliveryMode::from_env_value(&raw.file_delivery_mode) {
            Ok(mode) => mode,
            Err(msg) => {
                tracing::error!(%msg, "Invalid configuration");
                std::process::exit(1);
            }
        };

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
            file_delivery_mode,
            internal_file_base_url: raw
                .internal_file_base_url
                .and_then(|v| if v.trim().is_empty() { None } else { Some(v) }),
            internal_api_key: raw
                .internal_api_key
                .and_then(|v| if v.trim().is_empty() { None } else { Some(v) }),
        };

        if let Err(msg) = config.validate() {
            tracing::error!(%msg, "Invalid configuration");
            std::process::exit(1);
        }

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
            file_delivery_mode = %config.file_delivery_mode,
            "Resolved yt-api config"
        );

        config
    }

    fn validate(&self) -> Result<(), String> {
        if self.yt_api_port < 1 {
            return Err(format!(
                "YT_API_PORT must be between 1 and 65535, got {}",
                self.yt_api_port
            ));
        }

        if !self.grpc_target.starts_with("http://") && !self.grpc_target.starts_with("https://") {
            return Err(format!(
                "GRPC_TARGET must start with http:// or https://, got '{}'",
                self.grpc_target
            ));
        }

        if self.file_delivery_mode == FileDeliveryMode::Remote {
            let base_url = self
                .internal_file_base_url
                .as_deref()
                .ok_or_else(|| {
                    "INTERNAL_FILE_BASE_URL is required when FILE_DELIVERY_MODE=remote".to_string()
                })?;
            if !base_url.starts_with("http://") && !base_url.starts_with("https://") {
                return Err(format!(
                    "INTERNAL_FILE_BASE_URL must start with http:// or https://, got '{base_url}'"
                ));
            }

            let api_key = self.internal_api_key.as_deref().ok_or_else(|| {
                "INTERNAL_API_KEY is required when FILE_DELIVERY_MODE=remote".to_string()
            })?;

            if api_key.len() < INTERNAL_API_KEY_MIN_LEN {
                return Err(format!(
                    "INTERNAL_API_KEY must be at least {INTERNAL_API_KEY_MIN_LEN} characters when FILE_DELIVERY_MODE=remote (use e.g. openssl rand -hex 32)"
                ));
            }
        }

        Ok(())
    }

    pub fn addr(&self) -> String {
        format!("{}:{}", self.yt_api_host, self.yt_api_port)
    }

    pub fn governor_period_secs(&self) -> u64 {
        60u64 / (self.rate_limit_rpm as u64).max(1)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn remote_config_with_key(key: Option<&str>) -> Config {
        Config {
            yt_api_host: "0.0.0.0".into(),
            yt_api_port: 3000,
            grpc_target: "http://yt-service:50051".into(),
            log_level: "info".into(),
            request_timeout_ms: 30_000,
            streaming_timeout_secs: 600,
            max_body_size_bytes: 1_048_576,
            rate_limit_rpm: 30,
            allowed_origins: default_allowed_origins(),
            download_dir: std::path::PathBuf::from("/tmp"),
            file_delivery_mode: FileDeliveryMode::Remote,
            internal_file_base_url: Some("http://10.0.2.15:8081".into()),
            internal_api_key: key.map(String::from),
        }
    }

    #[test]
    fn remote_mode_requires_internal_api_key() {
        let err = remote_config_with_key(None).validate().unwrap_err();
        assert!(err.contains("INTERNAL_API_KEY is required"));
    }

    #[test]
    fn remote_mode_rejects_too_short_internal_api_key() {
        let err = remote_config_with_key(Some("short"))
            .validate()
            .unwrap_err();
        assert!(
            err.contains("at least 16 characters"),
            "expected min-length error, got: {err}"
        );
    }

    #[test]
    fn remote_mode_accepts_min_length_internal_api_key() {
        remote_config_with_key(Some("0123456789abcdef"))
            .validate()
            .unwrap();
    }

    #[test]
    fn local_mode_does_not_require_internal_api_key() {
        let mut cfg = remote_config_with_key(None);
        cfg.file_delivery_mode = FileDeliveryMode::Local;
        cfg.internal_file_base_url = None;
        cfg.validate().unwrap();
    }
}
