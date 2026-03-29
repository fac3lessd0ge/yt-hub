// Public library API

export type { YtDlpConfig } from "./config";
export { loadYtDlpConfig } from "./config";
export type { DownloadParams, DownloadResult } from "./DownloadService";
export { DownloadService } from "./DownloadService";
export type {
  DownloadProgress,
  FormatInfo,
  IDownloadBackend,
  ProgressCallback,
} from "./download";
export { CancellationError, DownloadError } from "./download";
export { ValidationError } from "./input";
// Re-export shared types for consumers
export type { VideoMetadata } from "./metadata";
export type { ILogger } from "./infra";
