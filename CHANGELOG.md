# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.3.5] - 2026-04-23

### Fixed

- **`DownloadForm` respects `defaultFormat` from Settings** (#127, #133) — the preferred format is now preselected on the Download page when its id is in the server-provided format list. Falls back to the first server format if the saved value is unavailable, and does not overwrite an explicit user choice mid-session.
- **"Show in folder" works outside `$HOME`** (#128, #134) — removed the home-directory guard that broke the feature for downloads saved to non-`C:\Users\*` drives on Windows or external volumes on macOS. Handler extracted into a pure helper (`src/main/showItemInFolder.ts`) for unit-testable behavior. Gracefully falls back to `shell.openPath(parent)` when the file has been moved or deleted; surfaces OS-level `openPath` errors instead of masking them.
- **Re-download from History starts the download in single-mode** (#129, #135) — previously `SingleDownloadPage` ignored the re-download request because `consumeRedownload` was only wired into the queue-mode branch. Now both branches share a `ConsumeRedownloadProps` type and `SingleDownloadPage` calls `start(req)` directly when a redownload is consumed, gated on `state === "idle"` so it does not interrupt an in-flight download.

### Added

- **TTL-based retention for `yt-service` downloads** (#132, #138) — in-process `DownloadSweeper` runs an immediate sweep on boot and periodic `setInterval` sweeps, unlinking regular files in `DOWNLOAD_DIR` older than `DOWNLOAD_RETENTION_MINUTES`. Structured logging per sweep (`download_sweep`) and per delete (`download_sweep_deleted` at `debug`). Registered in graceful shutdown (stopped before internal HTTP and gRPC so disk I/O quiesces first). Prevents unbounded disk growth on VM2. New env vars: `DOWNLOAD_RETENTION_MINUTES` (default `60`, prod `30`), `DOWNLOAD_SWEEP_INTERVAL_SECONDS` (default `300`, minimum `60`), `DOWNLOAD_CLEANUP_DISABLED` (debug escape hatch).
- **Automated `main → dev` back-merge PR after every release** (#131, #137) — new `.github/workflows/sync-main-to-dev.yml` triggered on `release: published` and `workflow_dispatch`. Idempotent: short-circuits when an open sync PR already exists for the tag, and uses `git switch -C` + `--force-with-lease` so re-runs after a stale remote branch do not fail. Opens a PR to `dev` with `sync` + `automated` labels; no auto-merge. Prevents the version-conflict churn that hit v1.3.3 → v1.3.4 → v1.3.5 planning. Note: this workflow does not fire for v1.3.5's own release (added in the same milestone); back-merge for 1.3.5 is manual, automation kicks in from v1.3.6.

### Documentation

- **Clearer guidance on `FILE_DELIVERY_MODE` in two-VM deploys** (#125, #136) — `yt-service` now emits a structured `internal_http_server_started` log line with `fileDeliveryMode` and `internalFilesRouteEnabled` at boot, so misconfiguration (VM2 left on `local` while VM1 expects `remote`) is grep-able from `docker logs yt-service` immediately. `.env.prod.vm2.example` ships with `FILE_DELIVERY_MODE=remote` plus an explanatory comment; `docs/deploymentRunbook.md` §1 "Security model" has a new callout noting that both VMs must set the var. Splitting the env var into two (per-VM flags) is explicitly deferred.

### Deferred to v1.4.0

- **Move yt-client HTTP traffic from renderer to Electron main (CORS elimination)** (#126) — originally scoped to v1.3.5 but moved to v1.4.0 during planning as the only large architectural change in the milestone. v1.3.5 stays a compact stability/DX release; v1.4.0 becomes the architectural release.

## [1.3.4] - 2026-04-22

### Fixed

- **Traefik/Docker API v29+ compatibility**: bumped Traefik image, corrected dynamic config file paths in `docker-compose.prod.*.yml`, and the VM1 deploy script now validates Traefik config and recreates the container when host paths change
- **yt-client `.env` loading**: Electron main process now loads `.env` so `YT_HUB_API_URL` dev overrides actually take effect
- **Local dev bind-mount permissions**: yt-api and yt-service Dockerfiles accept `APP_UID`/`APP_GID` build args; `scripts/localProd.sh` exports the host's uid/gid before `docker compose up`, so files written under `./downloads/` are owned by the invoking host user. Defaults (1001/1001) preserve existing production behavior.

### Added

- **CD workflow targets per VM**: `workflow_dispatch` inputs refactored to `action` (`deploy`/`rollback`) + `version_tag` + `target_vm` (`vm1`/`vm2`/`both`). Preflight now resolves and prints `deploy_mode` / `deploy_target` before any downstream jobs run.
- `DOWNLOAD_DIR` env baked into the VM2 yt-service container; host downloads directory is ensured before container start

### Security

- Bumped `rustls-webpki` 0.103.12 → 0.103.13 in yt-api to clear **RUSTSEC-2026-0104** (reachable panic when parsing certificate revocation lists with an empty `BIT STRING` in `IssuingDistributionPoint.onlySomeReasons`). Transitive via `rustls` / `tokio-rustls` / `hyper-rustls` / `metrics-exporter-prometheus`.

### Infrastructure

- Dev script (`npm run dev`) made cross-platform (Windows-friendly)

## [1.3.3] - 2026-04-21

### Added

- **Self-sufficient CD rollout**: deploy/rollback workflows now sync `scripts/` and the VM-specific `docker-compose.prod.vm*.yml` to the target VM over SCP before running. VMs no longer need a pre-cloned repo checkout.
- CD performs an explicit `docker login ghcr.io` via `GHCR_USERNAME`/`GHCR_PAT` on the remote side before `docker compose pull`. These are new required GitHub secrets.
- Rollback scripts wait for the service to become healthy and fail the job if health is not reached within `DEPLOY_TIMEOUT_SECONDS`.
- Preflight prints deployment intent and validates GHCR secrets alongside the existing SSH secret checks.

### Fixed

- `cd.yml` passes SSH connection secrets via the reusable workflow's `secrets:` block instead of `with:` — fixes GitHub's automatic secret masking breaking the SSH step on manual dispatch.

## [1.3.2] - 2026-04-21

### Added

- **Two-VM production topology**: VM1 (public edge, Traefik + yt-api) + VM2 (internal yt-service with file store). New compose files `docker-compose.prod.vm1.yml` and `docker-compose.prod.vm2.yml` and VM-specific env templates (`.env.prod.vm1.example`, `.env.prod.vm2.example`).
- yt-api file delivery abstraction: `FILE_DELIVERY_MODE=local` serves from local disk (single-host default), `FILE_DELIVERY_MODE=remote` streams from VM2's internal HTTP service via `INTERNAL_FILE_BASE_URL`.
- yt-service internal HTTP server on VM2 (`/internal/health`, `/internal/files/{filename}`) with shared-secret auth (`INTERNAL_API_KEY`) and per-IP rate limiting.
- New env vars: `FILE_DELIVERY_MODE`, `INTERNAL_FILE_BASE_URL`, `INTERNAL_API_KEY`, `INTERNAL_HTTP_HOST`, `INTERNAL_HTTP_PORT`.
- `scripts/deploy-vm1.sh`, `scripts/deploy-vm2.sh`, `scripts/rollback-vm1.sh`, `scripts/rollback-vm2.sh` for explicit per-VM operations.
- `.editorconfig` and `.gitattributes` for consistent line endings across OSes.

### Changed

- yt-api switched `reqwest` TLS backend to `native-tls` for smaller images and fewer transitive deps.
- yt-api gRPC error path uses boxed `tonic::Status` for clearer error propagation.
- yt-api `Content-Disposition` output contract locked by an explicit test.

### Fixed

- `INTERNAL_API_KEY` now enforced to be ≥16 characters in remote mode (startup fails fast otherwise).
- yt-client dock/window icons set in dev mode as well as packaged builds.
- Filename handling bugs in yt-api file proxy path.

### Security

- VM2 host ports bound to `127.0.0.1` by default so internal gRPC/HTTP aren't publicly reachable unless explicitly reconfigured.

## [1.3.1] - 2026-04-20

### Added

- yt-client: DMG installer for macOS, real YT wordmark icon wired through electron-forge and renderer favicon.
- yt-client: single-instance lock — relaunch focuses the existing window.
- yt-client: persist and restore window bounds between sessions.
- yt-client: About section in Settings (app version, GitHub link) and version exposed via IPC in the sidebar.
- yt-client: app name set; About panel configured.

### Changed

- yt-client: hide the native menu bar on Windows and Linux.
- yt-client: prevent white flash on startup (`show: false` + `backgroundColor`).

### Security

- Bumped `rustls-webpki` in yt-api to clear RUSTSEC-2026-0098/0099.
- Bumped `protobufjs` via override to clear a critical CVE.

## [1.3.0] - 2026-04-12

Major yt-client UX release.

### Added

- **Settings page**: theme (System/Light/Dark), default download directory, default format — all instant-apply, persisted via `electron-store`, FOUC-free theme switching.
- **Download queue**: when a default directory is set, downloads enter a queue with up to 2 concurrent slots; inline progress, cancel/retry/remove per item.
- **Batch downloads**: Single/Batch tab switcher, multi-URL textarea with validation count, `.txt` import, metadata prefetch with unique-name handling to avoid server-side file collisions.
- **Download history**: persistent (up to 500 entries via electron-store), search by title/author, filter All/Video/Audio, date-grouped (Today/Yesterday/calendar), file-existence check, one-click re-download.
- Clipboard paste button that validates and fills YouTube URLs.
- Friendly error messages mapped from raw error codes.

### Changed

- yt-client download form: compact 2-row layout (URL + Format + Paste | File Name).
- Download page: dual mode — single flow if no default directory, queue mode otherwise.
- SSE errors are retryable by default; `MAX_CONCURRENT` reduced to 2 to match new queue.

### Fixed

- Clipboard paste no longer lets stale metadata refill the file name field.
- Format dropdown width made adaptive (was fixed `w-24`).
- Brighter destructive colors in dark mode for readability.

## [1.2.0] - 2026-04-12

Resilience + contract-safety + test-quality push.

### Added

- yt-client: Zod-based SSE payload validation (schemas shared via yt-downloader).
- yt-client: React error boundary with graceful crash recovery and reload button.
- yt-client: refetch capability on `useFormats` and `useBackends`.
- yt-downloader: Zod schema foundation for contract types (shared with yt-service request validation).
- yt-api tests: rate limiting middleware, `validate_filename`, `serve_file` integration, `mime_from_extension` coverage.
- yt-service tests: real error classes in `ErrorMapper` tests; OS-assigned port in tests (no port-collision flakiness).

### Changed

- yt-client: streams file downloads to disk instead of buffering in memory.
- yt-client: preload caches the API URL so the renderer no longer uses `sendSync`.
- yt-client: removed silent SSE reconnect — stream drops now surface an error.
- yt-service: request validation now uses Zod schemas shared with yt-downloader; error checks switched to `instanceof`; `any` replaced with generated proto types.
- yt-api: `validate_destination` now restricted to the downloads directory.
- yt-api: `MatchedPath` used in metrics labels (prevents label-cardinality bomb from raw request paths).
- yt-api: middleware reordered so the metrics layer observes timeout responses; gRPC call boilerplate extracted into a macro.

### Fixed

- yt-client white-screen caused by yt-downloader pulling Node.js code into the renderer bundle.

## [1.1.2] - 2026-04-11

### Fixed

- yt-api container: pinned `DOWNLOAD_DIR` inside the Dockerfile so a bind-mounted `.env` cannot override the container-internal path.
- yt-api Dockerfile: renamed `DOWNLOADS_DIR` → `DOWNLOAD_DIR` to match the config struct.
- CI verify-ci job: uses the Checks API on the PR head commit instead of the commit-status API (fixes false negatives on merge commits).

### Changed

- All package READMEs updated to reflect the then-current state of the codebase.

## [1.1.0] - 2026-04-11

Stability, observability and production-readiness follow-up to 1.0.0.

### Added

- yt-downloader: `TimeoutError` class for process timeout signaling.
- yt-downloader `ILogger` interface extended with `debug`/`warn` methods.
- Shared error code `RATE_LIMIT_EXCEEDED` across all services.
- yt-client `DownloadError` type gains a `retryable` field, matching the server contract.
- Ops: resource limits (CPU/memory) and log rotation (`json-file` driver, size+count caps) applied to all Docker Compose services.

### Changed

- yt-api reads `DOWNLOAD_DIR` via the `Config` struct rather than ad-hoc env reads.
- yt-api: `assert!` in config validation replaced with structured error logging + proper exit.
- yt-service production Docker image now ships compiled JS only (no `tsx`, no devDependencies).
- yt-service: pino logger injected into `DownloadService` so yt-downloader logs share the same structured format.
- CD pipeline is now gated on CI passing on the tagged commit before images are built/pushed.
- CI uses a dynamic base branch instead of hardcoded `origin/dev`.

### Fixed

- yt-client: `AbortController` in `useMetadata` prevents stale responses from overwriting current state.
- yt-client: guard against concurrent downloads; fixed an async `onComplete` race in `useDownload`.
- yt-service: `DownloadHandler` re-throws the mapped error so `GrpcServer` emits the correct gRPC error status.
- yt-downloader: `NodeProcessSpawner` no longer double-settles and now surfaces timeout errors; abort listener removed on timeout for defensive cleanup.
- Monitoring: self-referencing AlertManager receiver replaced with a visible placeholder.

## [1.0.0] - 2026-04-10

First GA release — end-to-end tests, fuzz coverage, and CI smoke tests sealed the 0.x series.

### Added

- CI: integration test job and docker-compose smoke-test job.
- yt-api: property-based fuzz tests for URL, filename, destination validators.
- yt-api: middleware integration tests for security headers, CORS, and request ID propagation.
- yt-client: SSE parser fuzz tests (edge cases, binary payloads, oversized events).
- yt-downloader: fuzz tests for `sanitizeFilename` and the progress parser.

## [0.7.0] - 2026-04-10

Accessibility, resilience, and proto tooling.

### Added

- yt-client: ARIA attributes on DownloadForm, DownloadProgress, DownloadResult, Sidebar, OfflineBanner (`aria-required`, `aria-invalid`, `aria-describedby`, `aria-current`, `role="alert"`, `role="status"`, `aria-live`); autofocus on URL input; keyboard shortcut Escape-to-cancel.
- yt-client: client-side YouTube URL pre-validation before requests.
- yt-client: offline detection with banner and outbound-request guard.
- yt-client: SSE auto-reconnect on stream drop (later removed in 1.2 in favor of surfacing errors).
- yt-client: retry with exponential backoff and 429 `Retry-After` handling.
- yt-client: configurable API URL with Electron runtime override (`YT_HUB_API_URL`).
- yt-downloader: detect output-path collisions, append `(1)`, `(2)` suffix.
- yt-downloader: normalize progress — `100%` on completion, `Unknown` speed/ETA fallback.
- yt-downloader: `--continue` flag for resume support.
- proto: versioned package (`yt_hub.v1`), proto→TS codegen via buf/ts-proto.
- `scripts/localProd.sh`: now also starts the monitoring stack.

### Changed

- Error-mapping consolidated in yt-api `error.rs`; shared error codes extracted in yt-service (dedup'd ErrorMapper); duplicate URL validation removed from yt-downloader `DownloadService`.

### Fixed

- yt-downloader: close readline on process exit; capture stderr correctly.

## [0.5.0] - 2026-04-10

Security Hardening II, monitoring reliability, and timeout enforcement.

### Added

- yt-api: deep health check with gRPC connectivity verification.
- Monitoring: AlertManager with Prometheus alert rules.
- Monitoring: 7-day Loki retention policy with compactor; Promtail positions persisted across restarts; Grafana credentials parameterized; service healthchecks added.
- CI/CD: BuildKit GHA cache in both pipelines; npm cache on yt-service.
- Security Hardening Epic 16 (rate-limit expansion, header tightening, key rotation tooling).

### Fixed

- Enforce timeouts on gRPC connections, RPC calls, yt-dlp process, and SSE streaming.
- yt-client: fixed silent error swallowing in SSE, API client, and save flow.
- yt-api: cancel metrics upkeep on shutdown and run final flush.
- yt-api: apply rate limiting to `/metrics` endpoint.

## [0.4.5] - 2026-04-02

### Added

- File download endpoint: `GET /api/downloads/{filename}` serves downloaded files via HTTP with streaming response, path traversal protection, and Content-Disposition header
- `download_url` field in SSE complete event — clients can fetch the file directly from the server
- Electron save dialog: on download complete, native OS save dialog opens and file is saved to user-chosen location
- "Show in Folder" button in download result view
- `DOWNLOADS_DIR` env var for configuring the file serving directory in yt-api
- Local Docker testing script (`scripts/localProd.sh`) — builds and tests the full stack without Traefik

### Changed

- yt-dlp updated from 2024.12.23 to 2026.03.17 in yt-service Dockerfile
- `YT_DLP_VERSION` is now a configurable build arg in docker-compose.yml
- Docker downloads volume changed from named volume to bind mount (`DOWNLOAD_DIR` env var, defaults to `./downloads`)
- yt-api container now has read-only access to downloads directory for file serving
- Local testing script rewritten to skip Traefik (incompatible with Docker Desktop v29+)

### Fixed

- Download path in UI now shows user's local save path instead of container-internal path

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
