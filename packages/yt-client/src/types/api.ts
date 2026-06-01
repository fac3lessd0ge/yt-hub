// Shared contract types. Pure-type re-exports from yt-downloader's Zod schemas
// (import from "yt-downloader/schemas" to avoid pulling in Node.js-only code).
export type {
  DownloadProgress,
  FormatInfo,
  VideoMetadata,
} from "yt-downloader/schemas";

// --- yt-client UI-facing types ---

/** Metadata as surfaced to the renderer (snake_case for display components). */
export interface MetadataResponse {
  title: string;
  author_name: string;
  thumbnail?: string;
}

export interface FormatsResponse {
  formats: Array<{ id: string; label: string }>;
}

export interface BackendsResponse {
  backends: string[];
}

export interface DownloadRequest {
  link: string;
  format: string;
  name: string;
  downloadId?: string;
}

/**
 * Completed-download summary rendered by DownloadResult. The file already
 * exists on disk (no `download_url`); `localPath` carries the final path.
 */
export interface DownloadComplete {
  output_path: string;
  title: string;
  author_name: string;
  format_id: string;
  format_label: string;
  source?: string;
}

export interface DownloadError {
  code: string;
  message: string;
  retryable?: boolean;
}

// --- IPC event payloads (main → renderer) ---

export interface DownloadProgressEvent {
  downloadId: string;
  percent: number;
  speed: string;
  eta: string;
}

export interface DownloadCompleteEvent {
  downloadId: string;
  filePath: string;
  result: DownloadComplete;
}

export interface DownloadErrorEvent {
  downloadId: string;
  code: string;
  message: string;
}
