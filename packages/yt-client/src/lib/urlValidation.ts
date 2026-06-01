// Client-side URL gate. Delegates to the shared media-source registry
// (`yt-downloader/source`) so the renderer and the downloader agree on exactly
// which URLs are accepted — no duplicated allow-list. The registry is pure
// (uses only the global URL), safe to bundle into the Node-free renderer.

import { detectSource, type MediaSource } from "yt-downloader/source";

const MAX_URL_LENGTH = 2048;

/**
 * Returns a human-readable error string if `url` is not a supported media URL,
 * or null when it is valid (or empty, so the field doesn't error while typing).
 */
export function getUrlValidationError(url: string): string | null {
  if (!url) return null;

  if (url.length > MAX_URL_LENGTH) {
    return `URL must not exceed ${MAX_URL_LENGTH} characters`;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "URL must start with http:// or https://";
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "URL must start with http:// or https://";
  }

  const detected = detectSource(url);
  if (!detected) {
    return "Not a supported URL (YouTube, SoundCloud, VK, Bandcamp)";
  }
  if (detected.kind === "playlist") {
    return "Playlists aren't supported yet — paste a single track or video URL";
  }

  return null;
}

/** True when the URL is a single downloadable track/video (not a playlist). */
export function isSupportedMediaUrl(url: string): boolean {
  return !!url && detectSource(url)?.kind === "track";
}

/** The detected media source for a URL, or null if unsupported. */
export function getMediaSource(url: string): MediaSource | null {
  return detectSource(url)?.source ?? null;
}
