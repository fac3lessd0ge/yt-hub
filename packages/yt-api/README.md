# yt-api

A Rust/Axum REST API that serves as the main backend for the [yt-client](../yt-client) desktop app. Acts as a gRPC client to [yt-service](../yt-service), translating HTTP/JSON requests into gRPC calls. Download progress is streamed to clients via SSE (Server-Sent Events).

## Features

- **REST API** with JSON request/response for metadata, formats, and backends
- **SSE streaming** for real-time download progress over HTTP
- **gRPC client** auto-generated from the shared proto definition
- **CORS** with configurable origin allowlist (not permissive)
- **Structured error responses** with proper HTTP status codes
- **Security middleware**: rate limiting, body size limit, request timeouts, security headers

## Prerequisites

- [Rust](https://rustup.rs/) toolchain
- [protoc](https://grpc.io/docs/protoc-installation/) (`brew install protobuf`)
- [yt-service](../yt-service) running on port 50051

## Running

```bash
# From monorepo root
npx nx serve yt-api

# Or directly
cd packages/yt-api
cargo run
```

The server listens on `0.0.0.0:3000` by default. Configure via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `YT_API_HOST` | `0.0.0.0` | HTTP bind address |
| `YT_API_PORT` | `3000` | HTTP port |
| `GRPC_TARGET` | `http://localhost:50051` | yt-service gRPC endpoint |
| `LOG_LEVEL` | `info` | Log verbosity (`trace`, `debug`, `info`, `warn`, `error`) |
| `REQUEST_TIMEOUT_MS` | `30000` | Request timeout in milliseconds |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Comma-separated CORS allowed origins |
| `MAX_BODY_SIZE_BYTES` | `1048576` | Maximum request body size in bytes |
| `RATE_LIMIT_RPM` | `30` | Rate limit: requests per minute per IP |
| `STREAMING_TIMEOUT_SECS` | `600` | SSE download stream timeout in seconds |
| `DOWNLOAD_DIR` | `/home/appuser/Downloads/yt-downloader` | Directory to serve downloaded files from |

## REST API

### `GET /api/metadata?link=<url>`

Fetch video metadata without downloading.

```bash
curl "localhost:3000/api/metadata?link=https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

```json
{ "title": "Rick Astley - Never Gonna Give You Up", "author_name": "Rick Astley" }
```

### `GET /api/formats`

List available download formats.

```bash
curl localhost:3000/api/formats
```

```json
{ "formats": [{ "id": "mp3", "label": "MP3 audio" }, { "id": "mp4", "label": "MP4 video" }] }
```

### `GET /api/backends`

List available download backends.

```bash
curl localhost:3000/api/backends
```

```json
{ "backends": ["yt-dlp"] }
```

### `POST /api/downloads`

Start a download with real-time SSE progress streaming.

```bash
curl -X POST localhost:3000/api/downloads \
  -H 'Content-Type: application/json' \
  -d '{"link":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","format":"mp3","name":"rickroll"}' \
  --no-buffer
```

Response is `Content-Type: text/event-stream`:

```
event: progress
data: {"percent":45.2,"speed":"2.50MiB/s","eta":"00:05"}

event: progress
data: {"percent":100.0,"speed":"3.00MiB/s","eta":"00:00"}

event: complete
data: {"output_path":"/tmp/rickroll.mp3","download_url":"/api/downloads/rickroll.mp3","title":"...","author_name":"...","format_id":"mp3","format_label":"MP3 audio"}
```

On failure:
```
event: error
data: {"code":"INVALID_URL","message":"URL does not look like a YouTube link.","retryable":false}
```

### `GET /api/downloads/{filename}`

Serve a previously downloaded file.

```bash
curl -O localhost:3000/api/downloads/rickroll.mp3
```

Returns the file with `Content-Disposition: attachment` header. Returns 404 if file not found.

### Error Response Format

All errors follow a standardized format:

```json
{ "code": "ERROR_CODE", "message": "Human-readable description", "retryable": true }
```

Error codes: `VALIDATION_ERROR`, `INVALID_URL`, `VIDEO_NOT_FOUND`, `METADATA_FAILED`, `DOWNLOAD_FAILED`, `DEPENDENCY_MISSING`, `SERVICE_UNAVAILABLE`, `REQUEST_TIMEOUT`, `CANCELLED`, `INTERNAL_ERROR`, `SERIALIZATION_ERROR`, `GRPC_ERROR`, `FILE_NOT_FOUND`, `RATE_LIMIT_EXCEEDED`

### Input Validation

- **YouTube URL**: must match `youtube.com/watch`, `youtu.be`, or `youtube.com/shorts` hostnames
- **Format**: must be one of the supported format IDs (`mp3`, `mp4`)
- **Name**: non-empty, max 255 characters, no path separators

## Security Middleware

yt-api applies several security layers via Axum middleware:

| Layer | Description | Configuration |
|-------|-------------|---------------|
| **CORS** | Explicit origin allowlist (no permissive mode) | `ALLOWED_ORIGINS` env var |
| **Rate limiting** | Per-IP rate limiting via `tower_governor` with `SmartIpKeyExtractor` (X-Forwarded-For aware). Returns 429 with `Retry-After` header. | `RATE_LIMIT_RPM` env var |
| **Body size limit** | Rejects requests exceeding the configured body size | `MAX_BODY_SIZE_BYTES` env var |
| **Request timeouts** | 30s for regular routes, 10min for SSE download streams. Router is split into `regular_routes()` and `streaming_routes()` for per-route configuration. | `REQUEST_TIMEOUT_MS` env var |
| **Security headers** | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection: 0`, `Content-Security-Policy: default-src 'none'` | Not configurable |

## Observability

### Structured Logging

yt-api uses `tower-http` TraceLayer for structured JSON logging. Every log line is JSON with fields like `target`, `span`, `level`, and `timestamp`.

Log level is controlled by the `LOG_LEVEL` environment variable (also accepts `RUST_LOG` for fine-grained per-crate filtering). Valid levels: `trace`, `debug`, `info`, `warn`, `error`.

### Request IDs

Every incoming request is assigned a UUID v4 request ID. The ID is:

- Generated automatically if not present in the incoming request
- Returned in the `x-request-id` response header
- Propagated as `x-request-id` metadata in gRPC calls to yt-service
- Included in all log entries for the request span

### Metrics

yt-api exposes a Prometheus-compatible `/metrics` endpoint.

```bash
curl localhost:3000/metrics
```

Available metrics:

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `http_requests_total` | Counter | `method`, `path`, `status` | Total HTTP requests |
| `http_request_duration_seconds` | Histogram | `method`, `path` | Request latency distribution |
| `downloads_active` | Gauge | — | Currently active downloads |
| `grpc_calls_total` | Counter | `method`, `status` | Total gRPC calls to yt-service |

## Docker

```bash
# Build and run via Docker Compose (from monorepo root)
docker compose up --build yt-api
```

The Dockerfile uses a multi-stage build with [cargo-chef](https://github.com/LukeMathWalker/cargo-chef) for dependency caching. Build context is the monorepo root (required because `build.rs` references proto files from `../yt-service/proto/`).

## Testing

yt-api has 62 tests covering error mapping, input validation, route handlers, and SSE stream lifecycle.

```bash
# Run all tests
cargo test

# Or via Nx
npx nx test yt-api
```

Tests use a `GrpcClientTrait` abstraction extracted from the concrete gRPC client, allowing route handlers to be tested with mock clients via `tower::ServiceExt::oneshot` (no running server needed).

Test breakdown:

- **Error mapping tests (10)**: verify AppError to HTTP status code mapping
- **Validation tests (22)**: URL format, format ID, filename, destination rules
- **Integration tests (12)**: all routes using tower oneshot with mock gRPC client
- **Fuzz tests (6)**: property-based testing for URL/filename/destination validators
- **Config tests (6)**: configuration parsing and validation
- **SSE stream tests (6)**: stream lifecycle, progress events, completion, error propagation

## Development

```bash
# Build
npx nx build yt-api

# Run tests
npx nx test yt-api

# Lint (clippy)
npx nx lint yt-api
```

## Architecture

```
src/
├── main.rs           # Entry point — config, DI wiring, Axum server
├── lib.rs            # Library root — AppState definition
├── config.rs         # Config from environment variables (with validation)
├── error.rs          # AppError → HTTP status code mapping, shared error codes
├── validation.rs     # Input validation (URL, format, filename, destination)
├── grpc/
│   └── client.rs     # GrpcClient wrapper around tonic-generated stub
├── middleware/
│   ├── metrics.rs    # Prometheus metrics middleware
│   ├── rateLimit.rs  # Rate limiting via tower_governor
│   ├── request_id.rs # Request ID generation and propagation
│   └── securityHeaders.rs # Security headers middleware
├── routes/
│   ├── mod.rs        # Router construction (regular + streaming + metrics)
│   ├── metadata.rs   # GET /api/metadata
│   ├── formats.rs    # GET /api/formats
│   ├── backends.rs   # GET /api/backends
│   ├── downloads.rs  # POST /api/downloads (SSE) + GET /api/downloads/{filename}
│   ├── health.rs     # GET /health (with optional deep check)
│   └── metrics.rs    # GET /metrics
└── models/
    ├── requests.rs   # JSON request deserialization types
    └── responses.rs  # JSON response serialization types + From<proto> impls
```

## License

MIT
