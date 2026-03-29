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

# Or directly
cd packages/yt-service
npx tsx src/index.ts
```

The server listens on `0.0.0.0:50051` by default. Configure via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `GRPC_HOST` | `0.0.0.0` | Bind address |
| `GRPC_PORT` | `50051` | Port |
| `LOG_LEVEL` | `info` | Log verbosity |
| `REQUEST_TIMEOUT_MS` | `30000` | Request timeout in milliseconds |
| `MAX_MESSAGE_SIZE` | `4194304` | Max gRPC message size in bytes |

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

Error codes: `VALIDATION_ERROR`, `INVALID_URL`, `VIDEO_NOT_FOUND`, `METADATA_FAILED`, `DOWNLOAD_FAILED`, `DEPENDENCY_MISSING`, `SERVICE_UNAVAILABLE`, `REQUEST_TIMEOUT`, `CANCELLED`, `INTERNAL_ERROR`, `SERIALIZATION_ERROR`, `GRPC_ERROR`

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

The Dockerfile uses a multi-stage build: installs workspace dependencies, builds yt-downloader, then creates a slim runtime image with `ffmpeg` and a pinned version of `yt-dlp`. Downloads are stored in a persistent Docker volume.

To override the yt-dlp version at build time:
```bash
docker compose build --build-arg YT_DLP_VERSION=2025.01.15 yt-service
```

## Testing

yt-service has 15+ tests covering request validation, error propagation, and server lifecycle.

```bash
# Run all tests
npx vitest run

# Or via Nx
npx nx test yt-service
```

Test breakdown:

- **RequestValidator tests (6)**: URL format, format/name field validation
- **Error propagation tests (4)**: yt-downloader errors mapped correctly to gRPC status codes
- **Server lifecycle tests (5)**: port binding, graceful shutdown, port conflict detection

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
├── index.ts              # Entry point — DI wiring, server start
├── server/               # gRPC server lifecycle
│   ├── types/            # IGrpcServer interface
│   ├── implementations/  # GrpcServer (@grpc/grpc-js wrapper)
│   └── errors/           # ServerError
├── handlers/             # RPC handler implementations
│   ├── types/            # IUnaryHandler, IStreamHandler interfaces
│   ├── implementations/  # DownloadHandler, MetadataHandler, FormatsHandler, BackendsHandler
│   └── errors/           # HandlerError
└── mapping/              # Type mapping between yt-downloader and proto
    ├── ErrorMapper.ts    # yt-downloader errors → proto error codes
    └── ResponseMapper.ts # yt-downloader types → proto messages
```

## License

MIT
