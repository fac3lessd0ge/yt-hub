// Public library API
export { DownloadService } from "./DownloadService";
export type { DownloadParams, DownloadResult } from "./DownloadService";

// Re-export shared types for consumers
export type { VideoMetadata } from "./metadata";
export type {
  FormatInfo,
  IDownloadBackend,
  DownloadProgress,
  ProgressCallback,
} from "./download";
export { DownloadError } from "./download";
export { ValidationError } from "./input";
