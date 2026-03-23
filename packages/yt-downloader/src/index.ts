// Public library API
export { DownloadService } from "./DownloadService";
export type {
  DownloadParams,
  DownloadResult,
  DownloadProgress,
  ProgressCallback,
} from "./DownloadService";

// Re-export shared types for consumers
export type { VideoMetadata } from "./metadata";
export type { FormatInfo, IDownloadBackend } from "./download";
export { DownloadError } from "./download";
export { ValidationError } from "./input";
