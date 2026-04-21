//! Cross-service contract: yt-api (remote file proxy) <-> yt-service internal HTTP.
//! Any change here must be mirrored in `packages/yt-service/src/internalHttp/protocol.ts`
//! and released together.

pub const HEADER_INTERNAL_API_KEY: &str = "x-internal-api-key";

pub const PATH_INTERNAL_HEALTH: &str = "/internal/health";

/// Prefix only; append percent-encoded filename (path segment).
pub const PATH_INTERNAL_FILES_PREFIX: &str = "/internal/files/";
