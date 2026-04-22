# yt-service

A gRPC microservice that exposes [yt-downloader](../yt-downloader) functionality over the network. Designed to be consumed by a Rust backend via [tonic](https://github.com/hyperium/tonic)/[prost](https://github.com/tokio-rs/prost).

## Features

- **gRPC API** for downloading YouTube videos as MP3/MP4
- **Server-side streaming** for real-time download progress
- **Metadata fetching** without downloading
- **Format and backend discovery** RPCs
- **Structured error responses** with typed error codes

## Prerequisites

- Node.js 20+
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) and [ffmpeg](https://ffmpeg.org/) on PATH (for actual downloads)

## Running

```bash
# From monorepo root — builds yt-downloader first, then starts the server
npx nx serve yt-service

# Or directly (development)
cd packages/yt-service
npx tsx src/index.ts

# In production / Docker
node dist/index.js
```

The server listens on `0.0.0.0:50051` by default. Configure via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `GRPC_HOST` | `0.0.0.0` | Bind address |
| `GRPC_PORT` | `50051` | Port |
| `LOG_LEVEL` | `info` | Log verbosity |
| `REQUEST_TIMEOUT_MS` | `30000` | Request timeout in milliseconds |
| `MAX_MESSAGE_SIZE` | `4194304` | Max gRPC message size in bytes |
| `DOWNLOAD_DIR` | `/home/appuser/Downloads/yt-downloader` | Directory yt-downloader writes into. In the production compose files and the VM2 compose, this is pinned to the in-container path; the host-side bind-mount source is the top-level `DOWNLOAD_DIR` in the environment. |
| `INTERNAL_HTTP_HOST` | `0.0.0.0` | Bind address of the VM2-only internal HTTP server (file proxy + health) |
| `INTERNAL_HTTP_PORT` | `8081` | Port of the internal HTTP server |
| `INTERNAL_API_KEY` | — | Shared secret that must be present (header) on every internal HTTP request. Required in two-VM production mode. |

## gRPC API

Service definition: [`proto/yt_service.proto`](proto/yt_service.proto)

### `GetMetadata` (Unary)

Fetch video metadata without downloading.

```protobuf
rpc GetMetadata(GetMetadataRequest) returns (GetMetadataResponse);
```

```bash
grpcurl -plaintext -d '{"link": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}' \
  localhost:50051 yt_service.YtService/GetMetadata
```

### `ListFormats` (Unary)

List available download formats.

```protobuf
rpc ListFormats(ListFormatsRequest) returns (ListFormatsResponse);
```

Response: `{ formats: [{ id: "mp3", label: "MP3 audio" }, { id: "mp4", label: "MP4 video" }] }`

### `ListBackends` (Unary)

List available download backends.

```protobuf
rpc ListBackends(ListBackendsRequest) returns (ListBackendsResponse);
```

Response: `{ backends: ["yt-dlp"] }`

### `Download` (Server Streaming)

Download a video with real-time progress streaming.

```protobuf
rpc Download(DownloadRequest) returns (stream DownloadResponse);
```

The stream sends multiple messages using a `oneof payload`:

1. **Progress updates** during download:
   ```json
   { "progress": { "percent": 45.2, "speed": "2.50MiB/s", "eta": "00:05" } }
   ```

2. **Completion** on success:
   ```json
   { "complete": { "output_path": "/tmp/song.mp3", "title": "...", "author_name": "...", "format_id": "mp3", "format_label": "MP3 audio" } }
   ```

3. **Error** on failure:
   ```json
   { "error": { "code": "INVALID_URL", "message": "URL does not look like a YouTube link.", "retryable": false } }
   ```

Error codes: `VALIDATION_ERROR`, `INVALID_URL`, `VIDEO_NOT_FOUND`, `METADATA_FAILED`, `DOWNLOAD_FAILED`, `DEPENDENCY_MISSING`, `SERVICE_UNAVAILABLE`, `REQUEST_TIMEOUT`, `CANCELLED`, `INTERNAL_ERROR`, `SERIALIZATION_ERROR`, `GRPC_ERROR`, `FILE_NOT_FOUND`, `RATE_LIMIT_EXCEEDED`

### Request Validation

A `RequestValidator` validates all incoming gRPC requests before processing:

- YouTube URL format and hostname validation
- Format and name field validation
- Returns `INVALID_ARGUMENT` gRPC status on validation failure

### Cancellation Support

Download RPCs support client-initiated cancellation. When a client cancels the gRPC stream, the cancellation propagates through to yt-downloader via `AbortSignal`.

### gRPC Status Code Mapping

| Error Code | gRPC Status |
|------------|-------------|
| `VALIDATION_ERROR`, `INVALID_URL` | `INVALID_ARGUMENT` |
| `VIDEO_NOT_FOUND` | `NOT_FOUND` |
| `DOWNLOAD_FAILED`, `METADATA_FAILED` | `INTERNAL` |
| `DEPENDENCY_MISSING` | `FAILED_PRECONDITION` |
| `SERVICE_UNAVAILABLE` | `UNAVAILABLE` |
| `REQUEST_TIMEOUT` | `DEADLINE_EXCEEDED` |
| `CANCELLED` | `CANCELLED` |

## Logging

yt-service uses [Pino](https://getpino.io/) for structured JSON logging, replacing all `console.log`/`console.error` calls.

- **Structured JSON output**: every log line is machine-parsable JSON with `level`, `time`, `msg`, and contextual fields
- **Request ID propagation**: extracts the `x-request-id` value from incoming gRPC metadata and creates a child logger scoped to that request, so all logs for a single request share the same `requestId` field
- **PinoLoggerAdapter**: implements the `ILogger` interface from yt-downloader, bridging Pino into the download library's logging system
- **DownloadService injection**: the PinoLoggerAdapter is injected into yt-downloader's `DownloadService` as a child logger with `{ component: "yt-downloader" }`, ensuring all download library logs are structured JSON

Log level is controlled by the `LOG_LEVEL` environment variable (`debug`, `info`, `warn`, `error`).

## Rust Client Example

Using tonic with the proto file:

```rust
let mut client = YtServiceClient::connect("http://localhost:50051").await?;

let mut stream = client
    .download(DownloadRequest {
        link: "https://www.youtube.com/watch?v=dQw4w9WgXcQ".into(),
        format: "mp3".into(),
        name: "rickroll".into(),
        destination: None,
        backend: None,
    })
    .await?
    .into_inner();

while let Some(response) = stream.message().await? {
    match response.payload {
        Some(Payload::Progress(p)) => println!("{}%", p.percent),
        Some(Payload::Complete(c)) => println!("Done: {}", c.output_path),
        Some(Payload::Error(e)) => eprintln!("[{}] {}", e.code, e.message),
        None => {}
    }
}
```

## Docker

```bash
# Build and run via Docker Compose (from monorepo root)
docker compose up --build yt-service
```

The Dockerfile uses a 3-stage build: (1) build stage compiles TypeScript via tsup, (2) deps stage installs production-only node_modules, (3) runtime stage creates a slim image with `ffmpeg`, a pinned `yt-dlp` (SHA256-verified), and compiled JS only — no tsx or devDependencies.

### Build args

| Arg | Default | Purpose |
|-----|---------|---------|
| `YT_DLP_VERSION` | e.g. `2026.03.17` | yt-dlp release fetched at build time (SHA256-checked against `YT_DLP_SHA256`). |
| `YT_DLP_SHA256` | release-specific | Checksum for `yt-dlp`; update this alongside `YT_DLP_VERSION`. |
| `APP_UID` | `1001` | uid of the container `appuser`. Set to the host uid for local dev so bind-mounted `./downloads` stays writable. `scripts/localProd.sh` sets this to `$(id -u)` automatically. |
| `APP_GID` | `1001` | gid of the container `appuser` (paired with `APP_UID`). |

To override the yt-dlp version at build time:
```bash
docker compose build --build-arg YT_DLP_VERSION=2026.03.17 yt-service
```

## Testing

yt-service has 60+ tests covering request validation, error propagation, server lifecycle, handlers, response mapping, and the PinoLoggerAdapter.

```bash
# Run all tests
npx vitest run

# Or via Nx
npx nx test yt-service
```

Test areas:

- **RequestValidator**: URL format and format/name field validation (shared Zod schemas with yt-downloader)
- **Error propagation & scenarios**: yt-downloader errors mapped to gRPC status codes; `instanceof`-based error classification
- **Response mapper**: yt-downloader → proto message mapping
- **Server lifecycle**: port binding, graceful shutdown, port conflict detection (OS-assigned ports in tests)
- **Handlers**: metadata, formats, backends, download — unary + streaming
- **Logger adapter**: PinoLoggerAdapter delegation to Pino
- **Internal HTTP**: file proxy route auth (shared-secret) and per-IP rate limiting on VM2

## Development

```bash
# Run tests
npx nx test yt-service

# Type check
npx nx typecheck yt-service

# Lint
npx nx lint yt-service
```

## Architecture

```
src/
├── index.ts              # Entry point — DI wiring, server start, logger injection
├── config.ts             # Configuration loading from environment
├── errorCodes.ts         # Shared error code constants (synced with yt-api)
├── generated/            # Proto-generated TypeScript types
├── server/               # gRPC server lifecycle
│   ├── types/            # IGrpcServer interface
│   ├── implementations/  # GrpcServer (@grpc/grpc-js wrapper)
│   └── errors/           # ServerError
├── handlers/             # RPC handler implementations
│   ├── types/            # IUnaryHandler, IStreamHandler interfaces
│   ├── implementations/  # DownloadHandler, MetadataHandler, FormatsHandler, BackendsHandler
│   └── errors/           # HandlerError
├── logger/               # Structured logging
│   ├── pinoLogger.ts     # Pino logger factory
│   └── pinoLoggerAdapter.ts # ILogger adapter for pino (injected into DownloadService)
└── mapping/              # Type mapping between yt-downloader and proto
    ├── ErrorMapper.ts    # yt-downloader errors → proto error codes
    └── ResponseMapper.ts # yt-downloader types → proto messages
```

## License

MIT
