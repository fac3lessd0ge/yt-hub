# YT Hub

A monorepo for downloading YouTube videos as MP3/MP4 — from a TypeScript download library to a gRPC microservice to a Rust REST API to an Electron desktop app.

## Architecture

```
yt-client (Electron/React) → HTTP → yt-api (Rust/Axum) → gRPC → yt-service (Node/gRPC) → yt-downloader (TS lib) → yt-dlp
```

| Package | Language | Description |
|---------|----------|-------------|
| [`yt-downloader`](packages/yt-downloader) | TypeScript | Core download library and CLI. Wraps yt-dlp with a pluggable backend architecture. |
| [`yt-service`](packages/yt-service) | TypeScript | gRPC microservice exposing yt-downloader over the network with streaming progress. |
| [`yt-api`](packages/yt-api) | Rust | Axum REST API that translates HTTP/JSON to gRPC. SSE for download progress. |
| [`yt-client`](packages/yt-client) | TypeScript/React | Electron desktop app with real-time download progress UI. |

## Prerequisites

- **Node.js 20+** and npm
- **Rust** toolchain ([rustup](https://rustup.rs/))
- **protoc** (`brew install protobuf`)
- **yt-dlp** (`brew install yt-dlp`)
- **ffmpeg** (`brew install ffmpeg`)

## Quick Start

```bash
# Install dependencies
npm install

# Build yt-downloader (yt-service depends on the built output)
npx nx build yt-downloader

# Start the full stack (each in a separate terminal)
npx nx serve yt-service    # gRPC server on :50051
npx nx serve yt-api        # REST API on :3000
npx nx serve yt-client     # Electron desktop app
```

## Development

The monorepo uses [Nx](https://nx.dev/) for task orchestration and caching, and [Biome](https://biomejs.dev/) for linting and formatting.

```bash
# Run all tests
npx nx run-many -t test

# Run all linters
npx nx run-many -t lint

# Type check all TypeScript packages
npx nx run-many -t typecheck

# Build yt-downloader library
npx nx build yt-downloader

# Build yt-api (Rust, release mode)
npx nx build yt-api

# Package yt-client for distribution
npx nx build yt-client
```

### Per-package commands

```bash
npx nx serve <package>     # Start in dev mode
npx nx test <package>      # Run tests
npx nx lint <package>      # Run linter
npx nx typecheck <package> # Type check (TS packages only)
npx nx build <package>     # Build
```

## CI

GitHub Actions runs on every pull request to `main` or `dev`:

- Installs Node.js 20, Rust toolchain, and protoc
- Builds yt-downloader
- Runs lint, test, and typecheck across all packages

## Project Structure

```
yt-hub/
├── packages/
│   ├── yt-downloader/    # TypeScript download library + CLI
│   ├── yt-service/       # gRPC microservice (Node.js)
│   ├── yt-api/           # REST API (Rust/Axum)
│   └── yt-client/        # Desktop app (Electron/React)
├── .github/workflows/    # CI pipeline
├── biome.json            # Linting and formatting config
├── nx.json               # Nx task orchestration config
└── tsconfig.base.json    # Shared TypeScript config
```

## License

MIT
