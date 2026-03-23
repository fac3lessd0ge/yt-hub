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
   { "error": { "code": "VALIDATION", "message": "URL does not look like a YouTube link." } }
   ```

Error codes: `VALIDATION`, `DOWNLOAD`, `METADATA`, `DEPENDENCY`, `INTERNAL`

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
