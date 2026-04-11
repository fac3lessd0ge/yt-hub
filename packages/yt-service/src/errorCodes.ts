// Error codes shared between yt-api (Rust) and yt-service (TS).
// Must stay in sync with packages/yt-api/src/error.rs::error_codes.
export const VALIDATION_ERROR = "VALIDATION_ERROR" as const;
export const INVALID_URL = "INVALID_URL" as const;
export const VIDEO_NOT_FOUND = "VIDEO_NOT_FOUND" as const;
export const METADATA_FAILED = "METADATA_FAILED" as const;
export const DOWNLOAD_FAILED = "DOWNLOAD_FAILED" as const;
export const DEPENDENCY_MISSING = "DEPENDENCY_MISSING" as const;
export const SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE" as const;
export const REQUEST_TIMEOUT = "REQUEST_TIMEOUT" as const;
export const CANCELLED = "CANCELLED" as const;
export const INTERNAL_ERROR = "INTERNAL_ERROR" as const;
export const SERIALIZATION_ERROR = "SERIALIZATION_ERROR" as const;
export const GRPC_ERROR = "GRPC_ERROR" as const;
export const FILE_NOT_FOUND = "FILE_NOT_FOUND" as const;
export const RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED" as const;
