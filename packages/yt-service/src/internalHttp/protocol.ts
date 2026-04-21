/**
 * Cross-service contract: yt-api remote proxy <-> yt-service internal HTTP.
 * Mirror: packages/yt-api/src/internal_protocol.rs — change both in the same release.
 */

export const HEADER_INTERNAL_API_KEY = "x-internal-api-key";

export const PATH_INTERNAL_HEALTH = "/internal/health";

/** Prefix only; request path is `${PATH_INTERNAL_FILES_PREFIX}${encodeURIComponent(filename)}`. */
export const PATH_INTERNAL_FILES_PREFIX = "/internal/files/";
