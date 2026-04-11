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

### Docker (recommended)

```bash
cp .env.example .env
docker compose up --build
```

This builds and starts both backend services (yt-api on `:3000`, yt-service on `:50051`) with proper health checks and startup ordering. Downloads are saved to `./downloads/` on the host (configurable via `DOWNLOAD_DIR`).

To also start the monitoring stack (Prometheus, Grafana, Loki):

```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up --build
```

### Local Docker testing

To test the full Docker stack locally (without Traefik):

```bash
bash scripts/localProd.sh up      # build + start
bash scripts/localProd.sh test    # run smoke tests
bash scripts/localProd.sh down    # stop + cleanup
```

### Local development

```bash
npm install
npm run dev
```

This single command builds yt-downloader, then starts yt-service, yt-api, and yt-client in the correct order — waiting for each service to be ready before starting the next. Output is color-coded by service. Press `Ctrl+C` to shut everything down.

### Manual startup

If you prefer to run services individually (each in a separate terminal):

```bash
npm install
npx nx build yt-downloader    # must be built first
npx nx serve yt-service       # gRPC server on :50051
npx nx serve yt-api           # REST API on :3000 (needs yt-service)
npx nx serve yt-client        # Electron desktop app (needs yt-api)
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

## CI/CD

### CI (Pull Requests)

GitHub Actions runs on every pull request to `main` or `dev`:

- Installs Node.js 20, Rust toolchain, and protoc
- Builds yt-downloader
- Nx-affected smart testing (only tests changed packages)
- Explicit Rust clippy linting
- Docker build validation (path-filtered — only runs when Dockerfiles or related files change)
- Proto compatibility check

### CD (Releases)

- Tag-triggered (`v*.*.*`) workflow publishes Docker images to GHCR
- Dependabot keeps npm, Cargo, and GitHub Actions dependencies up to date (weekly, targeting `dev`)
- Weekly security scanning via `npm audit` and `cargo audit` (also runs on PRs)
- SBOM generation (CycloneDX) and `cargo-deny` advisory/license scanning in the security workflow

## Monitoring

The monitoring stack is defined in `docker-compose.monitoring.yml` and runs alongside the main services:

| Service | Port | Description |
|---------|------|-------------|
| **Grafana** | `3001` | Dashboards and log explorer. Default login: `admin`/`admin` |
| **Prometheus** | `9090` | Metrics collection and queries |
| **Loki** | `3100` | Log aggregation backend |
| **Promtail** | — | Ships container logs to Loki |

yt-api exposes a Prometheus-compatible `/metrics` endpoint at `http://localhost:3000/metrics`.

Pre-built Grafana dashboards are included: service overview, download metrics, and log volume.

```bash
# Start everything including monitoring
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up --build
```

## Production Deployment

Production uses Traefik as a reverse proxy with automatic Let's Encrypt TLS.

```bash
# First-time setup
cp .env.prod.example .env.prod
# Edit .env.prod with your domain and email
touch traefik/acme.json && chmod 600 traefik/acme.json

# Deploy
VERSION=v1.1.2 bash scripts/deploy.sh

# Rollback
bash scripts/rollback.sh v1.1.0
```

See [`docs/deploymentRunbook.md`](docs/deploymentRunbook.md) for the full deployment guide.

## Testing

Each package has its own test suite:

```bash
# Run all tests across the monorepo
npx nx run-many -t test

# Per-package
npx nx test yt-api           # 62 Rust tests (cargo test)
npx nx test yt-service       # Vitest (npx vitest run)
npx nx test yt-client        # Vitest + React Testing Library (jsdom)
npx nx test yt-downloader    # Vitest

# Integration tests for yt-downloader (requires yt-dlp on PATH)
INTEGRATION=1 npx nx test yt-downloader
```

## Configuration

Each package is configured via environment variables. See `.env.example` files in each package.

| Variable | Package | Default | Description |
|----------|---------|---------|-------------|
| `YT_API_HOST` | yt-api | `0.0.0.0` | HTTP bind address |
| `YT_API_PORT` | yt-api | `3000` | HTTP port |
| `GRPC_TARGET` | yt-api | `http://localhost:50051` | yt-service gRPC endpoint |
| `LOG_LEVEL` | yt-api | `info` | Log verbosity |
| `REQUEST_TIMEOUT_MS` | yt-api | `30000` | Request timeout in ms |
| `STREAMING_TIMEOUT_SECS` | yt-api | `600` | SSE download stream timeout in seconds |
| `GRPC_HOST` | yt-service | `0.0.0.0` | gRPC bind address |
| `GRPC_PORT` | yt-service | `50051` | gRPC port |
| `LOG_LEVEL` | yt-service | `info` | Log verbosity |
| `REQUEST_TIMEOUT_MS` | yt-service | `30000` | Request timeout in ms |
| `MAX_MESSAGE_SIZE` | yt-service | `4194304` | Max gRPC message size (bytes) |
| `ALLOWED_ORIGINS` | yt-api | `http://localhost:5173,http://localhost:3000` | Comma-separated CORS allowed origins |
| `MAX_BODY_SIZE_BYTES` | yt-api | `1048576` | Maximum request body size in bytes |
| `RATE_LIMIT_RPM` | yt-api | `30` | Rate limit: requests per minute per IP |
| `DOWNLOAD_DIR` | yt-api | `/home/appuser/Downloads/yt-downloader` | Directory to serve downloaded files from |
| `VITE_API_BASE_URL` | yt-client | `http://localhost:3000` | yt-api base URL |

yt-downloader is configured programmatically via `YtDlpConfig` (audioQuality, customArgs, proxy, cookiesFile, socketTimeout).

## Project Structure

```
yt-hub/
├── packages/
│   ├── yt-downloader/    # TypeScript download library + CLI
│   ├── yt-service/       # gRPC microservice (Node.js)
│   ├── yt-api/           # REST API (Rust/Axum)
│   └── yt-client/        # Desktop app (Electron/React)
├── scripts/              # Dev orchestration (npm run dev)
├── .github/workflows/    # CI pipeline
├── docker-compose.yml         # Docker Compose for backend services
├── docker-compose.prod.yml   # Production Docker Compose with Traefik
├── traefik/                  # Traefik v3 configuration
├── docs/                     # TLS strategy, deployment runbook
├── .env.example              # Environment variable template
├── biome.json            # Linting and formatting config
├── nx.json               # Nx task orchestration config
└── tsconfig.base.json    # Shared TypeScript config
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **Traefik fails with Docker Desktop v29+** | Use `scripts/localProd.sh` for local testing (skips Traefik) |
| **yt-dlp fails to download** | Update yt-dlp version: `docker compose build --build-arg YT_DLP_VERSION=YYYY.MM.DD yt-service` |
| **Download path shows container path** | Use the Electron save dialog (v0.4.5+) or access files in `./downloads/` on the host |
| **"Downloads directory not available"** | Ensure `DOWNLOAD_DIR` env var points to an existing directory, or create `./downloads/` |

## License

MIT
