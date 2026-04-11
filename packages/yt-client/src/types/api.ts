// Shared contract types — single source of truth is yt-downloader Zod schemas
export type {
  DownloadProgress,
  FormatInfo,
  VideoMetadata,
} from "yt-downloader";

// Re-export schemas for runtime validation
export {
  BackendsResponseSchema,
  DownloadCompleteSchema,
  DownloadErrorSchema,
  DownloadProgressSchema,
  FormatsResponseSchema,
  MetadataResponseSchema,
} from "yt-downloader";

// --- yt-client specific types (not in proto / yt-downloader) ---

export interface MetadataResponse {
  title: string;
  author_name: string;
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
  destination?: string;
  backend?: string;
}

// download_url is added by yt-api HTTP layer (not in proto)
export interface DownloadComplete {
  output_path: string;
  download_url: string;
  title: string;
  author_name: string;
  format_id: string;
  format_label: string;
}

export interface DownloadError {
  code: string;
  message: string;
  retryable?: boolean;
}
