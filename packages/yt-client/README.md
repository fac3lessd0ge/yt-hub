# yt-client

An Electron desktop application for downloading YouTube videos as MP3 or MP4. Built with React 19, Tailwind CSS v4, and shadcn/ui. Communicates with [yt-api](../yt-api) over HTTP, with real-time download progress via SSE.

## Features

- **Desktop app** built with Electron Forge + Vite
- **Download YouTube videos** as MP3 (audio) or MP4 (video)
- **Real-time progress** with speed and ETA via Server-Sent Events
- **Auto-fill metadata** — paste a link, title and author are fetched automatically
- **Native folder picker** for choosing download destination
- **Open in Finder/Explorer** after download completes

## Prerequisites

- Node.js 20+
- [yt-api](../yt-api), [yt-service](../yt-service), and [yt-downloader](../yt-downloader) running for full functionality

## Running

```bash
# Start the full stack (each in a separate terminal)
npx nx serve yt-service    # gRPC microservice (port 50051)
npx nx serve yt-api        # REST API (port 3000)
npx nx serve yt-client     # Electron app
```

The app connects to `yt-api` at `http://localhost:3000`.

## Usage

1. Paste a YouTube link into the **YouTube Link** field
2. Metadata is fetched automatically — the file name is pre-filled with the video title
3. Select a **format** (MP3 or MP4)
4. Click **Download**
5. Watch the progress bar fill with real-time speed and ETA
6. When complete, see the result card with the file path

## Development

```bash
# Run in development mode (hot reload)
npx nx serve yt-client

# Run tests
npx nx test yt-client

# Type check
npx nx typecheck yt-client

# Lint
npx nx lint yt-client

# Package for distribution
npx nx package yt-client

# Build distributable installer
npx nx build yt-client
```

## Architecture

```
src/
├── main.ts               # Electron main process (BrowserWindow, IPC handlers)
├── preload.ts            # contextBridge for native features (folder picker, open in Finder)
├── renderer.ts           # React mount point
├── App.tsx               # Root component with state-based page routing
├── globals.css           # Tailwind v4 + shadcn/ui theme
├── lib/
│   ├── utils.ts          # cn() utility for class merging
│   ├── apiClient.ts      # Typed fetch wrappers for yt-api endpoints
│   └── sse.ts            # SSE-over-POST parser (manual fetch + ReadableStream)
├── hooks/
│   ├── useMetadata.ts    # Debounced metadata fetch on link change
│   ├── useFormats.ts     # Fetch available formats on mount
│   ├── useBackends.ts    # Fetch available backends on mount
│   └── useDownload.ts    # Download state machine with SSE progress tracking
├── types/
│   └── api.ts            # TypeScript types mirroring yt-api responses
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx  # Sidebar + content area layout
│   │   └── Sidebar.tsx   # Navigation sidebar
│   └── download/
│       ├── DownloadPage.tsx      # State machine: idle → downloading → complete/error
│       ├── DownloadForm.tsx      # Link, format, name inputs with metadata auto-fill
│       ├── DownloadProgress.tsx  # Progress bar, speed, ETA, cancel button
│       └── DownloadResult.tsx    # Completion card with file path
└── pages/
    └── Downloads.tsx     # Downloads page
```

## IPC

Minimal IPC bridge for native features only:

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `dialog:selectFolder` | Renderer → Main | Open native folder picker |
| `shell:showItemInFolder` | Renderer → Main | Open file in Finder/Explorer |

All API communication goes through HTTP to yt-api (no IPC for data).

## License

MIT
