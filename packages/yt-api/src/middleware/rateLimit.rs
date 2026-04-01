use std::sync::Arc;

use axum::body::Body;
use axum::http::Response;
use tower_governor::{GovernorError, GovernorLayer};
use tower_governor::governor::{GovernorConfig, GovernorConfigBuilder};
use tower_governor::key_extractor::SmartIpKeyExtractor;

type RateLimitLayer = GovernorLayer<SmartIpKeyExtractor, ::governor::middleware::NoOpMiddleware, Body>;

/// Build a per-IP rate-limiting layer.
///
/// Uses `SmartIpKeyExtractor` which checks `X-Forwarded-For`, `X-Real-IP`, and
/// `Forwarded` headers in order, then falls back to the peer IP address. This
/// ensures correct per-client rate limiting when the service runs behind a
/// reverse proxy such as Traefik or nginx.
///
/// `period_secs` is the refill interval per token; `burst_size` is the maximum
/// number of tokens that can accumulate before requests are rejected.
pub fn build_governor_layer(period_secs: u64, burst_size: u32) -> RateLimitLayer {
    let config: Arc<GovernorConfig<SmartIpKeyExtractor, _>> = Arc::new(
        GovernorConfigBuilder::default()
            .per_second(period_secs.max(1))
            .burst_size(burst_size)
            .key_extractor(SmartIpKeyExtractor)
            .finish()
            .expect("Invalid governor configuration"),
    );

    GovernorLayer::new(config).error_handler(|err: GovernorError| -> Response<Body> {
        let body = serde_json::json!({
            "code": "RATE_LIMIT_EXCEEDED",
            "message": "Too many requests",
            "retryable": true
        });

        let wait_header = if let GovernorError::TooManyRequests { wait_time, .. } = &err {
            Some(wait_time.to_string())
        } else {
            None
        };

        let mut builder = Response::builder()
            .status(axum::http::StatusCode::TOO_MANY_REQUESTS)
            .header(axum::http::header::CONTENT_TYPE, "application/json");

        if let Some(wait) = wait_header {
            builder = builder.header("retry-after", wait);
        }

        builder
            .body(Body::from(body.to_string()))
            .unwrap_or_else(|_| Response::new(Body::empty()))
    })
}
