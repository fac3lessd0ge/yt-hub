# yt-client

An Electron desktop application for downloading YouTube videos as MP3 or MP4. Built with React 19, Tailwind CSS v4, and shadcn/ui. Communicates with [yt-api](../yt-api) over HTTP, with real-time download progress via SSE.

## Features

### Downloads
- **Download YouTube videos** as MP3 (audio) or MP4 (video)
- **Real-time progress** with speed and ETA via Server-Sent Events
- **Auto-fill metadata** — paste a link, title and author are fetched automatically
- **Clipboard paste** — one-click paste button validates and fills YouTube URLs
- **Compact form** — 2-row layout: URL + Format + Paste | File Name

### Download Queue
- **Multi-download queue** — add multiple downloads, processed concurrently (max 2)
- **Queue UI** — inline progress bars, cancel/retry/remove per item
- **Auto-save** — downloads save directly when a default directory is set (no save dialog)
- **Filename collision handling** — appends `(1)`, `(2)` suffix for duplicates

### Batch Download
- **Single/Batch tabs** — switch between single URL and multi-URL input
- **Batch textarea** — paste multiple URLs, one per line, with real-time validation count
- **Import .txt** — load URLs from a text file
- **Metadata prefetch** — fetches titles for all URLs before adding to queue

### Download History
- **Persistent history** — up to 500 entries stored via electron-store
- **Search** — filter by title or author (case-insensitive)
- **Format filter** — All / Video / Audio toggle
- **Date grouping** — Today, Yesterday, and calendar date headers
- **File check** — warns when a downloaded file no longer exists on disk
- **Re-download** — one click to add a past download back to the queue

### Settings
- **Theme** — System / Light / Dark with segmented control, no FOUC (flash of unstyled content)
- **Default download directory** — browse to set, enables queue mode and auto-save
- **Default format** — pre-selected format for new downloads
- **Instant apply** — all settings take effect immediately, no Save button

### Resilience
- **Retry with backoff** — automatic retry (3x) with exponential backoff for API errors, 429/Retry-After handling
- **Offline detection** — network status monitoring with UI banner
- **Error boundary** — graceful crash recovery with reload button
- **Friendly errors** — human-readable messages instead of raw error codes
- **Zod SSE validation** — runtime validation of server events via shared schemas

### Accessibility
- **ARIA attributes** — `aria-required`, `aria-invalid`, `aria-describedby`, `aria-current`
- **Live regions** — `aria-live="polite"` for status updates, `role="alert"` for errors
- **Focus management** — auto-focus on URL input, keyboard navigation
- **Keyboard shortcuts** — Escape to cancel active download

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
| `VITE_API_BASE_URL` | `http://localhost:3000` | Base URL of the yt-api REST server (baked into the renderer at **build** time for production) |
| `YT_HUB_API_URL` | — | Electron **main** process override (see `main.ts`). In **dev**, this wins over `VITE_*`. In **packaged** builds, **baked `VITE_API_BASE_URL` wins** so a leftover `YT_HUB_API_URL=http://localhost:3000` on your OS does not break production installs. |

## Testing

yt-client has 110+ tests covering React components and custom hooks using [Vitest](https://vitest.dev/) with [jsdom](https://github.com/jsdom/jsdom) and [React Testing Library](https://testing-library.com/docs/react-testing-library/intro).

```bash
npx nx test yt-client
```

Test coverage:

- **Component tests**: DownloadForm, DownloadProgress, DownloadResult, DownloadPage — render states, user interactions, error display, accessibility
- **Hook tests**: useFormats, useBackends, useMetadata, useDownload, useOnlineStatus — data fetching, loading states, error handling, SSE progress tracking, offline detection
- **Utility tests**: URL validation, retry logic, SSE parser, fuzz tests

## Development

```bash
npx nx serve yt-client       # Dev mode (hot reload)
npx nx test yt-client        # Run tests
npx nx typecheck yt-client   # Type check
npx nx lint yt-client        # Lint (Biome)
npx nx package yt-client     # Package for distribution
npx nx build yt-client       # Build distributable installer
```

## Architecture

```
src/
├── main.ts                          # Electron main process (IPC, electron-store, dialogs)
├── preload.ts                       # contextBridge — secure IPC bridge
├── renderer.ts                      # React mount with SettingsProvider + ErrorBoundary
├── App.tsx                          # Root component with page routing + re-download flow
├── globals.css                      # Tailwind v4 + OKLch theme variables (light/dark)
├── lib/
│   ├── apiClient.ts                 # Typed fetch wrappers for yt-api endpoints
│   ├── retry.ts                     # Retry with exponential backoff, RateLimitError
│   ├── sse.ts                       # SSE parser with Zod validation
│   ├── urlValidation.ts             # YouTube URL pre-validation
│   ├── errorMessages.ts             # Error code → friendly message mapping
│   ├── formatType.ts                # Format → video/audio classification
│   ├── dateGroups.ts                # Group history entries by relative date
│   └── utils.ts                     # cn() class merging utility
├── hooks/
│   ├── useDownload.ts               # Single download state machine
│   ├── useQueue.ts                  # Queue reducer + concurrency manager
│   ├── useHistory.ts                # History: load, search, filter, actions
│   ├── useSettings.tsx              # SettingsContext + SettingsProvider
│   ├── useMetadata.ts               # Debounced metadata fetch
│   ├── useFormats.ts                # Format list with refetch
│   ├── useBackends.ts               # Backend list with refetch
│   ├── useOnlineStatus.ts           # Network status detection
│   └── useKeyboardShortcuts.ts      # Keyboard shortcut bindings
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx             # Sidebar + content layout
│   │   ├── Sidebar.tsx              # Navigation (Downloads, History, Settings)
│   │   └── OfflineBanner.tsx        # Offline indicator
│   ├── download/
│   │   ├── DownloadPage.tsx         # Dual mode: single download or queue
│   │   ├── DownloadForm.tsx         # Single/Batch tabs, URL+Format+Paste form
│   │   ├── BatchForm.tsx            # Multi-URL textarea + .txt import
│   │   ├── DownloadProgress.tsx     # Progress bar, speed, ETA
│   │   ├── DownloadResult.tsx       # Completion card
│   │   ├── QueueList.tsx            # Queue container with header
│   │   └── QueueItem.tsx            # Per-item: progress, cancel, retry, remove
│   ├── history/
│   │   ├── HistoryList.tsx          # Search + filter pills + grouped list
│   │   ├── HistoryItem.tsx          # Entry: show, re-download, remove
│   │   └── HistoryDateGroup.tsx     # Date group header
│   ├── settings/
│   │   ├── ThemeToggle.tsx          # System/Light/Dark segmented control
│   │   ├── DownloadLocationSetting.tsx  # Path display + Browse button
│   │   └── DefaultFormatSetting.tsx # Format dropdown
│   └── ErrorBoundary.tsx            # React error boundary
├── pages/
│   ├── Downloads.tsx                # Downloads page
│   ├── History.tsx                  # History page
│   └── Settings.tsx                 # Settings page
└── types/
    ├── api.ts                       # API types + Zod schema re-exports
    └── electron.d.ts                # IPC types (Settings, HistoryEntry, ElectronAPI)
```

## IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `dialog:selectFolder` | Renderer → Main | Open native folder picker |
| `dialog:saveDownload` | Renderer → Main | Download file, save via dialog or direct to directory |
| `dialog:openTextFile` | Renderer → Main | Open .txt file for batch URL import |
| `shell:showItemInFolder` | Renderer → Main | Open file in Finder/Explorer |
| `config:getApiBaseUrl` | Renderer → Main | Get API base URL from environment |
| `clipboard:readText` | Renderer → Main | Read clipboard text |
| `settings:getAll` | Renderer → Main | Get all settings |
| `settings:get` | Renderer → Main | Get single setting |
| `settings:set` | Renderer → Main | Update single setting |
| `settings:getTheme` | Renderer → Main | Sync theme read (FOUC prevention) |
| `history:getAll` | Renderer → Main | Get download history |
| `history:add` | Renderer → Main | Add history entry (auto-prune at 500) |
| `history:remove` | Renderer → Main | Remove single history entry |
| `history:clear` | Renderer → Main | Clear all history |
| `history:checkFile` | Renderer → Main | Check if file exists on disk |

## License

MIT
