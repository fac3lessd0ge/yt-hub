# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.4.0] - 2026-04-01

### Added

- CORS restriction: configurable origin allowlist via `ALLOWED_ORIGINS` env var (replaces permissive CORS)
- Request body size limit (1MB default) configurable via `MAX_BODY_SIZE_BYTES`
- Request timeouts: 30s for regular routes, 10min for SSE download streams
- Per-IP rate limiting via `tower_governor` (30 req/min default) with `Retry-After` header, configurable via `RATE_LIMIT_RPM`
- Security response headers: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Content-Security-Policy
- SBOM generation (CycloneDX) and `cargo-deny` license/advisory scanning in CI
- TLS strategy document (`docs/tlsStrategy.md`)
- Production Docker Compose (`docker-compose.prod.yml`) with Traefik v3 reverse proxy and Let's Encrypt TLS
- Traefik static configuration (`traefik/traefik.yml`) with HTTP→HTTPS redirect
- Deployment script (`scripts/deploy.sh`) with health check polling
- Rollback script (`scripts/rollback.sh`) for version rollback without Traefik restart
- Production environment template (`.env.prod.example`)
- Deployment runbook (`docs/deploymentRunbook.md`)

### Changed

- Rate limiter uses `SmartIpKeyExtractor` for correct IP extraction behind reverse proxy (X-Forwarded-For support)
- yt-api router split into `regular_routes()` and `streaming_routes()` for per-route timeout configuration
- yt-api Cargo.toml: added MIT license field

## [0.3.0] - 2026-03-29

### Added

- Structured JSON logging across all services (tower-http TraceLayer in yt-api, Pino in yt-service)
- Request ID propagation: UUID v4 generated per request, passed via x-request-id gRPC metadata
- Prometheus metrics endpoint (/metrics) in yt-api: request counts, latency histograms, active downloads, gRPC errors
- Monitoring stack: docker-compose.monitoring.yml with Prometheus, Grafana, Loki, Promtail
- Pre-built Grafana dashboards: service overview, download metrics, log volume
- ConsoleLogger upgrade in yt-downloader: log levels, ISO timestamps
- PinoLoggerAdapter in yt-service implementing ILogger interface
- 47 new Rust tests for yt-api (error mapping, validation, route handlers, SSE streams)
- GrpcClientTrait extraction for testable yt-api architecture
- 15 new tests for yt-service (RequestValidator, error scenarios, server lifecycle)
- 40+ new tests for yt-client (React component tests, hook tests)
- Integration tests for yt-downloader with real yt-dlp (INTEGRATION=1)
- React Testing Library + jsdom test infrastructure for yt-client

### Changed

- yt-api AppState is now generic over GrpcClientTrait (backward-compatible with default type parameter)
- yt-api download stream uses DownloadStream type alias for mockability
- yt-service uses Pino instead of console.log/console.error

## [0.2.0] - 2026-03-29

### Added

- CI: Docker build validation (path-filtered), explicit Rust clippy, Nx-affected smart testing, proto compatibility check
- CD workflow: tag-triggered (`v*.*.*`) Docker image publishing to GHCR
- Dependabot for npm, Cargo, and GitHub Actions (weekly, targeting `dev`)
- Security scanning: `npm audit` + `cargo audit` (weekly + on PRs)
- Standardized error format across all packages: `{"code", "message", "retryable"}`
- Error codes: VALIDATION_ERROR, INVALID_URL, VIDEO_NOT_FOUND, METADATA_FAILED, DOWNLOAD_FAILED, DEPENDENCY_MISSING, SERVICE_UNAVAILABLE, REQUEST_TIMEOUT, CANCELLED, INTERNAL_ERROR, SERIALIZATION_ERROR, GRPC_ERROR
- Input validation in yt-api: YouTube URL validation, format/name validation
- RequestValidator in yt-service gRPC handlers
- Download cancellation with AbortSignal through all layers
- URL hostname validation and filename sanitization with path traversal protection in yt-downloader
- Metadata retry: 3 attempts, exponential backoff, 10s timeout
- Configuration via environment variables: LOG_LEVEL, REQUEST_TIMEOUT_MS (yt-api), GRPC_HOST, GRPC_PORT, LOG_LEVEL, REQUEST_TIMEOUT_MS, MAX_MESSAGE_SIZE (yt-service), VITE_API_BASE_URL (yt-client)
- YtDlpConfig for yt-downloader (audioQuality, customArgs, proxy, cookiesFile, socketTimeout)
- `.env.example` files for all packages

### Changed

- yt-api uses `envy` crate for configuration
- yt-service uses `ServiceConfig` for centralized configuration
- Error codes updated from short names (VALIDATION, DOWNLOAD) to full taxonomy

## [0.1.0] - 2026-03-15

### Added

- **yt-downloader**: TypeScript download library/CLI with pluggable backend architecture
- **yt-service**: Node.js gRPC microservice with streaming download progress
- **yt-api**: Rust/Axum REST gateway with SSE streaming
- **yt-client**: Electron/React desktop app
- Docker Compose containerization for backend services
- Health checks and graceful shutdown for both backend services
- Nx monorepo with npm workspaces
