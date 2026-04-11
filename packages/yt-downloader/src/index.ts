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
export { CancellationError, DownloadError, TimeoutError } from "./download";
export type { ILogger } from "./infra";
export { ValidationError } from "./input";
export { MetadataError } from "./metadata";
export { DependencyError } from "./dependencies";
// Re-export shared types for consumers
export type { VideoMetadata } from "./metadata";

// Zod schemas for runtime validation
export {
  BackendsResponseSchema,
  DownloadCompleteSchema,
  DownloadErrorSchema,
  DownloadProgressSchema,
  DownloadRequestSchema,
  FormatInfoSchema,
  FormatsResponseSchema,
  MetadataRequestSchema,
  MetadataResponseSchema,
  VideoMetadataSchema,
} from "./schemas";
