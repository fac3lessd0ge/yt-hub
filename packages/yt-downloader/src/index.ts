// Public library API

export type { YtDlpConfig } from "./config";
export { loadYtDlpConfig } from "./config";
export type { DownloadParams, DownloadResult } from "./DownloadService";
export { DownloadService } from "./DownloadService";
export type { IBinaryResolver } from "./dependencies";
export { DependencyError } from "./dependencies";
export type {
  DownloadProgress,
  FormatInfo,
  IDownloadBackend,
  ProgressCallback,
} from "./download";
export { CancellationError, DownloadError, TimeoutError } from "./download";
export type { ILogger } from "./infra";
export { ValidationError } from "./input";
// Re-export shared types for consumers
export type { VideoMetadata } from "./metadata";
export { MetadataError } from "./metadata";
export { SpawnError } from "./process";
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
export type {
  DetectedSource,
  FormatCapability,
  MediaKind,
  MediaSource,
  SourceCapabilities,
  SourceProvider,
} from "./source";
// Media-source registry (shared by client + downloader)
export {
  capabilities,
  detectSource,
  getProvider,
  isSupportedUrl,
  SOURCES,
} from "./source";
