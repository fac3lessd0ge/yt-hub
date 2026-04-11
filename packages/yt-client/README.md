# yt-client

An Electron desktop application for downloading YouTube videos as MP3 or MP4. Built with React 19, Tailwind CSS v4, and shadcn/ui. Communicates with [yt-api](../yt-api) over HTTP, with real-time download progress via SSE.

## Features

- **Desktop app** built with Electron Forge + Vite
- **Download YouTube videos** as MP3 (audio) or MP4 (video)
- **Real-time progress** with speed and ETA via Server-Sent Events
- **Auto-fill metadata** — paste a link, title and author are fetched automatically
- **Save dialog** — native save-as dialog with file download from API
- **Retry with backoff** — automatic retry (3x) with exponential backoff for API errors, 429/Retry-After handling
- **SSE auto-reconnect** — stream drop recovery (3x with backoff)
- **Offline detection** — network status monitoring with UI banner
- **Client-side URL validation** — YouTube URL pre-validation before sending to API
- **Keyboard shortcuts** — Escape to cancel active download
- **Accessibility** — ARIA attributes, focus management, screen reader support

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

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:3000` | Base URL of the yt-api REST server |
| `YT_HUB_API_URL` | — | Electron runtime override for API base URL |

### Error Handling

API errors are surfaced from the `body.message` field of error responses.

## Usage

1. Paste a YouTube link into the **YouTube Link** field
2. Metadata is fetched automatically — the file name is pre-filled with the video title
3. Select a **format** (MP3 or MP4)
4. Click **Download**
5. Watch the progress bar fill with real-time speed and ETA
6. When complete, see the result card with the file path

## Testing

yt-client has 110+ tests covering React components and custom hooks using [Vitest](https://vitest.dev/) with [jsdom](https://github.com/jsdom/jsdom) and [React Testing Library](https://testing-library.com/docs/react-testing-library/intro).

```bash
# Run all tests
npx vitest run

# Or via Nx
npx nx test yt-client
```

Test coverage:

- **Component tests**: DownloadForm, DownloadProgress, DownloadResult, DownloadPage — render states, user interactions, error display, accessibility
- **Hook tests**: useFormats, useBackends, useMetadata, useDownload, useOnlineStatus — data fetching, loading states, error handling, SSE progress tracking, offline detection
- **Utility tests**: URL validation, retry logic, SSE parser

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
├── preload.ts            # contextBridge for native features (save dialog, folder picker, open in Finder)
├── renderer.ts           # React mount point
├── App.tsx               # Root component with state-based page routing
├── globals.css           # Tailwind v4 + shadcn/ui theme
├── lib/
│   ├── utils.ts          # cn() utility for class merging
│   ├── apiClient.ts      # Typed fetch wrappers for yt-api endpoints
│   ├── retry.ts          # Retry with exponential backoff, RateLimitError handling
│   ├── sse.ts            # SSE-over-POST parser with auto-reconnect (3x with backoff)
│   └── urlValidation.ts  # Client-side YouTube URL pre-validation
├── hooks/
│   ├── useMetadata.ts    # Debounced metadata fetch on link change
│   ├── useFormats.ts     # Fetch available formats on mount
│   ├── useBackends.ts    # Fetch available backends on mount
│   ├── useDownload.ts    # Download state machine with SSE progress tracking
│   ├── useOnlineStatus.ts # Network status detection with UI banner
│   └── useKeyboardShortcuts.ts # Configurable keyboard shortcut bindings
├── types/
│   └── api.ts            # TypeScript types mirroring yt-api responses
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx  # Sidebar + content area layout
│   │   └── Sidebar.tsx   # Navigation sidebar
│   └── download/
│       ├── DownloadPage.tsx      # State machine: idle → downloading → saving → complete/error
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
| `dialog:saveDownload` | Renderer → Main | Download file from API and save via native dialog |
| `shell:showItemInFolder` | Renderer → Main | Open file in Finder/Explorer |
| `config:getApiBaseUrl` | Renderer → Main | Get API base URL from Electron environment |

All API communication goes through HTTP to yt-api. IPC is used only for native OS features and configuration.

## License

MIT
