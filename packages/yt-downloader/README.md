# yt-downloader

A YouTube downloader that works as both a **CLI tool** and an **importable TypeScript/JavaScript library**. Built with Node.js and powered by [yt-dlp](https://github.com/yt-dlp/yt-dlp).

## Features

- Download YouTube videos as **MP3** (audio) or **MP4** (video)
- Use as a **CLI** with interactive prompts or flags
- Import as a **library** in your TypeScript/JavaScript projects
- Pluggable backend architecture (yt-dlp by default, extensible)
- Fetches video metadata before downloading
- Supports YouTube watch pages, short links (`youtu.be`), and Shorts
- Download cancellation via `AbortSignal`
- URL hostname validation and filename sanitization with path traversal protection
- Metadata retry with exponential backoff (3 attempts, 10s timeout)

## Prerequisites

### Node.js

Node.js 20+ is required. Install via [nvm](https://github.com/nvm-sh/nvm) or [nodejs.org](https://nodejs.org/).

### yt-dlp

```bash
brew install yt-dlp
```

Or see [yt-dlp installation docs](https://github.com/yt-dlp/yt-dlp#installation) for other platforms.

### ffmpeg

```bash
brew install ffmpeg
```

Required for audio extraction (MP3) and video merging (MP4).

## Installation

```bash
git clone <repo-url>
cd yt-downloader
npm install
```

## CLI Usage

### Quick commands

```bash
# Download as MP3 (prompts for link and name)
npm run download:song

# Download as MP4 (prompts for link and name)
npm run download:video

# Fully interactive (prompts for everything)
npm run download
```

### With flags

```bash
npm run download:song -- --link https://www.youtube.com/watch?v=dQw4w9WgXcQ --name rickroll

npm run download:video -- --link https://youtu.be/dQw4w9WgXcQ --name rickroll --destination ~/Videos
```

### All flags

| Flag | Required | Default | Description |
|------|----------|---------|-------------|
| `--link` | Yes* | Prompts interactively | YouTube URL |
| `--name` | Yes* | Prompts interactively | Output filename (extension added automatically) |
| `--format` | Yes* | Prompts interactively | `mp3` or `mp4` |
| `--destination` | No | `~/Downloads/yt-downloader` | Output directory |
| `--backend` | No | `yt-dlp` | Download backend to use |

*Required flags prompt interactively if not provided.

### Supported URL formats

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/shorts/VIDEO_ID`

## Library Usage

The package exports a `DownloadService` class that can be imported and used programmatically.

### Basic example

```typescript
import { DownloadService } from "yt-downloader";

const service = new DownloadService();

// Download a video as MP3
const result = await service.download({
  link: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  format: "mp3",
  name: "rickroll",
});

console.log(result.outputPath);      // /Users/.../Downloads/yt-downloader/rickroll.mp3
console.log(result.metadata.title);  // "Rick Astley - Never Gonna Give You Up"
```

### Fetch metadata only

```typescript
const metadata = await service.getMetadata("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
console.log(metadata.title);       // Video title
console.log(metadata.authorName);  // Channel name
```

### List available formats and backends

```typescript
service.listFormats();   // [{ id: "mp3", label: "MP3 audio" }, { id: "mp4", label: "MP4 video" }]
service.listBackends();  // ["yt-dlp"]
```

### Custom destination

```typescript
await service.download({
  link: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  format: "mp4",
  name: "video",
  destination: "/tmp/my-downloads",
});
```

### Error handling

```typescript
import { DownloadService, ValidationError, DownloadError, CancellationError } from "yt-downloader";

const service = new DownloadService();

try {
  await service.download({ link: "...", format: "mp3", name: "test" });
} catch (error) {
  if (error instanceof ValidationError) {
    // Invalid input (bad URL, unsupported format, missing fields)
  }
  if (error instanceof DownloadError) {
    // yt-dlp process failed — error.exitCode has the exit code
  }
  if (error instanceof CancellationError) {
    // Download was cancelled via AbortSignal
  }
}
```

### API Reference

#### `new DownloadService(options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `backend` | `string` | `"yt-dlp"` | Backend to use for downloads |
| `binaryResolver` | `IBinaryResolver` | `NodeBinaryResolver` | Custom binary resolver (for DI/testing) |
| `metadataFetcher` | `IMetadataFetcher` | `HttpMetadataFetcher` | Custom metadata fetcher (for DI/testing) |
| `backends` | `BackendRegistry` | Default registry | Custom backend registry |
| `ytDlpConfig` | `YtDlpConfig` | — | yt-dlp backend configuration |
| `logger` | `ILogger` | `ConsoleLogger` | Custom logger implementation |

#### `service.download(params): Promise<DownloadResult>`

**Params:**

```typescript
interface DownloadParams {
  link: string;          // YouTube URL
  format: string;        // "mp3" or "mp4"
  name: string;          // Output filename (no extension)
  destination?: string;  // Output directory (default: ~/Downloads/yt-downloader)
}
```

**Returns:**

```typescript
interface DownloadResult {
  outputPath: string;        // Full path to the downloaded file
  metadata: VideoMetadata;   // { title: string, authorName: string }
  format: FormatInfo;        // { id: string, label: string }
}
```

#### `service.getMetadata(link): Promise<VideoMetadata>`

Fetches video metadata via YouTube's oEmbed API without downloading.

#### `service.listFormats(): FormatInfo[]`

Returns formats supported by the active backend.

#### `service.listBackends(): string[]`

Returns names of all registered backends.

## Exported Types

```typescript
import type {
  DownloadParams,
  DownloadResult,
  DownloadProgress,
  ProgressCallback,
  VideoMetadata,
  FormatInfo,
  IDownloadBackend,
  ILogger,
  YtDlpConfig,
} from "yt-downloader";
```

## Configuration

The yt-dlp backend accepts a `YtDlpConfig` object:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `audioQuality` | `string` | `"0"` | Audio quality (0 = best) |
| `customArgs` | `string[]` | `[]` | Extra args passed to yt-dlp |
| `proxy` | `string` | — | Proxy URL |
| `cookiesFile` | `string` | — | Path to cookies file |
| `socketTimeout` | `number` | `30` | Socket timeout in seconds |

### URL Validation

URLs are parsed and validated against allowed hostnames:

- `www.youtube.com`, `youtube.com`, `m.youtube.com`
- `youtu.be`
- `www.youtube-nocookie.com`

Invalid hostnames or malformed URLs throw a `ValidationError`.

### Filename Sanitization

Output filenames are sanitized to prevent path traversal attacks. Characters like `/`, `\`, `..`, and control characters are stripped or replaced.

### Metadata Retry

Metadata fetching retries up to 3 times with exponential backoff and a 10-second timeout per attempt.

## Logging

yt-downloader provides a `ConsoleLogger` that implements the `ILogger` interface with structured output:

- **Log levels**: `debug`, `info`, `warn`, `error` with minimum level filtering
- **ISO timestamps**: every log line includes an ISO 8601 timestamp
- **Backward-compatible**: the `ILogger` interface allows consumers (like yt-service) to inject their own logger implementation

```typescript
import { ConsoleLogger } from "yt-downloader";

const logger = new ConsoleLogger("info"); // minimum level
logger.info("Download started");
// 2026-03-29T12:00:00.000Z [INFO] Download started
```

## Testing

```bash
# Unit tests
npx vitest run

# Integration tests (requires yt-dlp and ffmpeg on PATH)
INTEGRATION=1 npx vitest run

# Or via Nx
npx nx test yt-downloader
```

Integration tests exercise real downloads via yt-dlp and are guarded by the `INTEGRATION=1` environment variable. They are skipped by default to keep CI fast.

## Development

```bash
# Run tests
npx vitest run

# Type check
npx tsc --noEmit

# Lint
npx nx lint yt-downloader

# Build
npx nx build yt-downloader
```

## License

MIT
