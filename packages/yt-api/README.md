# yt-api

A Rust/Axum REST API that serves as the main backend for the [yt-client](../yt-client) desktop app. Acts as a gRPC client to [yt-service](../yt-service), translating HTTP/JSON requests into gRPC calls. Download progress is streamed to clients via SSE (Server-Sent Events).

## Features

- **REST API** with JSON request/response for metadata, formats, and backends
- **SSE streaming** for real-time download progress over HTTP
- **gRPC client** auto-generated from the shared proto definition
- **CORS** enabled for cross-origin requests
- **Structured error responses** with proper HTTP status codes

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
data: {"output_path":"/tmp/rickroll.mp3","title":"...","author_name":"...","format_id":"mp3","format_label":"MP3 audio"}
```

On failure:
```
event: error
data: {"code":"INVALID_URL","message":"URL does not look like a YouTube link.","retryable":false}
```

### Error Response Format

All errors follow a standardized format:

```json
{ "code": "ERROR_CODE", "message": "Human-readable description", "retryable": true }
```

Error codes: `VALIDATION_ERROR`, `INVALID_URL`, `VIDEO_NOT_FOUND`, `METADATA_FAILED`, `DOWNLOAD_FAILED`, `DEPENDENCY_MISSING`, `SERVICE_UNAVAILABLE`, `REQUEST_TIMEOUT`, `CANCELLED`, `INTERNAL_ERROR`, `SERIALIZATION_ERROR`, `GRPC_ERROR`

### Input Validation

- **YouTube URL**: must match `youtube.com/watch`, `youtu.be`, or `youtube.com/shorts` hostnames
- **Format**: must be one of the supported format IDs (`mp3`, `mp4`)
- **Name**: non-empty, max 255 characters, no path separators

## Docker

```bash
# Build and run via Docker Compose (from monorepo root)
docker compose up --build yt-api
```

The Dockerfile uses a multi-stage build with [cargo-chef](https://github.com/LukeMathWalker/cargo-chef) for dependency caching. Build context is the monorepo root (required because `build.rs` references proto files from `../yt-service/proto/`).

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
├── config.rs         # Config from environment variables
├── error.rs          # AppError → HTTP status code mapping
├── grpc/
│   └── client.rs     # GrpcClient wrapper around tonic-generated stub
├── routes/
│   ├── mod.rs        # Router construction
│   ├── metadata.rs   # GET /api/metadata
│   ├── formats.rs    # GET /api/formats
│   ├── backends.rs   # GET /api/backends
│   └── downloads.rs  # POST /api/downloads (SSE streaming)
└── models/
    ├── requests.rs   # JSON request deserialization types
    └── responses.rs  # JSON response serialization types + From<proto> impls
```

## License

MIT
