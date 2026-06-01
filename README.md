# YT Hub

A serverless desktop app for downloading YouTube videos as MP3/MP4. An Electron + React client drives a TypeScript download library in-process — no servers, no Docker, no HTTP. Files download straight to a folder you choose.

## Architecture

YT Hub is a two-package monorepo. The Electron **main** process owns the download logic and talks to the renderer over IPC; there is no network tier.

```
yt-client (Electron renderer / React)
        │  IPC (download:start/cancel, metadata:get, formats:list, backends:list)
        ▼
yt-client (Electron main)
        │  in-process call
        ▼
DownloadService  ──►  yt-downloader (TS lib)  ──►  yt-dlp + ffmpeg
```

| Package | Language | Description |
|---------|----------|-------------|
| [`yt-downloader`](packages/yt-downloader) | TypeScript | Core download library and CLI. Wraps yt-dlp with a pluggable backend architecture. |
| [`yt-client`](packages/yt-client) | TypeScript/React | Electron desktop app — downloads, queue, history, batch, settings. Hosts `DownloadService` in the main process. |

The renderer sends `download:start` / `download:cancel` and receives `download:progress`, `download:complete`, and `download:error` events. `metadata:get`, `formats:list`, and `backends:list` round-trip synchronously over `ipcRenderer.invoke`.

## Desktop App Features

The [yt-client](packages/yt-client) Electron app provides:

- **Single & batch downloads** — paste one URL or many at once (one per line, or import from .txt file)
- **Download queue** — up to 2 concurrent downloads with progress, cancel, retry per item
- **Clipboard paste** — one-click button validates and fills YouTube URLs
- **Auto-fill metadata** — titles and authors fetched automatically
- **Download history** — persistent (500 max), searchable by title/author, filterable by Video/Audio, grouped by date
- **Re-download** — one click from history to add back to queue
- **Settings** — theme (System/Light/Dark), default download directory, default format — all instant-apply
- **Auto-save** — when a download directory is set, files save directly without a dialog
- **Friendly errors** — human-readable messages instead of raw error codes
- **Offline detection** — banner shown when network is unavailable
- **Dark/Light theme** — FOUC-free theme switching with system preference support
- **Keyboard shortcuts** — Escape to cancel downloads
- **Accessibility** — ARIA attributes, live regions, focus management

## Prerequisites

- **Node.js 20+** and npm
- **yt-dlp** — on `PATH` for development, or bundled for packaged builds (see [The binary story](#the-binary-story))
- **ffmpeg** — same as yt-dlp

## Quick Start

```bash
npm install
npm run dev
```

`npm run dev` checks that `yt-dlp` and `ffmpeg` are on `PATH`, builds `yt-downloader`, then launches the Electron app. Output is color-coded by package. Press `Ctrl+C` to shut everything down.

## Building Installers

Build a distributable installer for the current platform:

```bash
npx nx package yt-client     # unpacked app in packages/yt-client/out/
# or, from the package directory:
npm run make                 # full installer via electron-forge
```

- **Windows** — a Squirrel `.exe` installer.
- **Linux** — a ZIP archive. The Linux `make` target shells out to the system `zip` binary, so install it first (e.g. `pacman -S zip` / `apt install zip`).

### Unsigned installers

Builds are **not code-signed**. On Windows, SmartScreen will warn the first time you run the installer — click **More info → Run anyway**. Linux ZIPs are unsigned as well.

## How Downloads Work

1. The renderer sends `download:start` to the main process with the URL, format, and file name.
2. Main reads the destination directory from the settings store (it never trusts a renderer-supplied path), then calls `DownloadService.download(...)` in-process.
3. `DownloadService` runs `yt-dlp` (with `ffmpeg` for muxing/transcoding) and streams progress back as `download:progress` events.
4. On success the file lands directly in your chosen download directory and main emits `download:complete` with the output path; failures surface as `download:error`. Cancellation flows through an `AbortController` triggered by `download:cancel`.

Files are written straight to the user's selected folder — there is no server-side staging directory and no HTTP file transfer.

### Proxy

If YouTube's media servers (`googlevideo.com`) are blocked or throttled on a direct connection — common with DPI/geo restrictions, even when the site loads in a browser — set a proxy under **Settings → Network**. The value (e.g. `socks5://127.0.0.1:2080`) is passed to yt-dlp via `--proxy`, so downloads tunnel through your VPN/proxy. Leave it empty for a direct connection.

## The Binary Story

`yt-dlp` and `ffmpeg` are located at runtime by a tiered resolver (`BundledBinaryResolver`), in this order:

1. `<userData>/bin/<binary>` — a per-user override you can drop in.
2. `<resourcesPath>/bin/<binary>` — binaries bundled into the packaged app.
3. `PATH` via `which`.

For **development**, having `yt-dlp` and `ffmpeg` on `PATH` is enough. For **distribution**, run `npm run binaries:fetch` to download pinned, checksum-verified `yt-dlp` + `ffmpeg` for the host platform into `packages/yt-client/resources/bin/` before packaging; electron-forge copies that `bin/` folder to `<resourcesPath>/bin` via `extraResource`, which is exactly where the resolver looks (on Windows the bundled `.exe` names are resolved too). The folder is gitignored, so it is absent in fresh clones and CI — the forge config adds it to `extraResource` only when present.

## Platform Support

- **Windows** and **Linux** are supported.
- **macOS** is out of scope.

## Development

The monorepo uses [Nx](https://nx.dev/) for task orchestration and caching, and [Biome](https://biomejs.dev/) for linting and formatting.

```bash
# Run all tests
npx nx run-many -t test

# Run all linters
npx nx run-many -t lint

# Type check all TypeScript packages
npx nx run-many -t typecheck

# Build the yt-downloader library
npx nx build yt-downloader
```

### Per-package commands

```bash
npx nx test <package>      # Run tests
npx nx lint <package>      # Run linter
npx nx typecheck <package> # Type check
npx nx build <package>     # Build
```

## Testing

```bash
# Run all tests across the monorepo
npx nx run-many -t test

# Per-package
npx nx test yt-client      # Vitest + React Testing Library (jsdom)
npx nx test yt-downloader  # Vitest

# Integration tests for yt-downloader (requires yt-dlp on PATH)
INTEGRATION=1 npx nx test yt-downloader
```

## Configuration

`yt-downloader` is configured programmatically via `YtDlpConfig` (audioQuality, customArgs, proxy, cookiesFile, socketTimeout).

`yt-client` settings (theme, download directory, default format) are persisted via `electron-store` and managed through the in-app Settings page.

## Project Structure

```
yt-hub/
├── packages/
│   ├── yt-downloader/    # TypeScript download library + CLI
│   └── yt-client/        # Desktop app (Electron/React); hosts DownloadService
├── scripts/              # Dev orchestration (npm run dev)
├── biome.json            # Linting and formatting config
├── nx.json               # Nx task orchestration config
└── tsconfig.base.json    # Shared TypeScript config
```

## Legacy Server Architecture

YT Hub was originally a four-package fullstack app: an Electron client talked over HTTP/SSE to a Rust (Axum) API, which spoke gRPC to a Node service that wrapped `yt-downloader`, all deployed via Docker/Traefik with Prometheus/Grafana monitoring. That architecture is frozen on the **`legacy/server-architecture`** branch and tagged **`v1.3.5-server`**.

## License

MIT
