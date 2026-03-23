// Public library API

export type { DownloadParams, DownloadResult } from "./DownloadService";
export { DownloadService } from "./DownloadService";
export type {
  DownloadProgress,
  FormatInfo,
  IDownloadBackend,
  ProgressCallback,
} from "./download";
export { DownloadError } from "./download";
export { ValidationError } from "./input";
// Re-export shared types for consumers
export type { VideoMetadata } from "./metadata";
