# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
