// Mirrors yt-api/src/validation.rs (validate_youtube_url): length cap,
// www./m. host normalization, /watch?v=, /shorts/<id>, youtu.be/<id>.
// Kept as the single client-side gate now that the Rust gateway is gone.

const MAX_URL_LENGTH = 2048;
const ALLOWED_HOSTS = new Set(["youtube.com", "youtu.be"]);

/** Strips `www.` and `m.` prefixes from a host string. */
function normalizeHost(host: string): string {
  let h = host.toLowerCase();
  if (h.startsWith("www.")) h = h.slice(4);
  if (h.startsWith("m.")) h = h.slice(2);
  return h;
}

export function isValidYoutubeUrl(url: string): boolean {
  return getUrlValidationError(url) === null && url.length > 0;
}

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

  const normalized = normalizeHost(parsed.hostname);
  if (!ALLOWED_HOSTS.has(normalized)) {
    return "Not a recognized YouTube URL";
  }

  if (normalized === "youtu.be") {
    // youtu.be/VIDEO_ID — path must carry a video ID.
    if (parsed.pathname.length <= 1) {
      return "Not a recognized YouTube URL";
    }
    return null;
  }

  // youtube.com: /watch?v=... or /shorts/VIDEO_ID
  const path = parsed.pathname;
  if (path === "/watch") {
    if (!parsed.searchParams.has("v")) {
      return "Not a recognized YouTube URL";
    }
    return null;
  }

  const shortsId = path.startsWith("/shorts/")
    ? path.slice("/shorts/".length)
    : null;
  if (shortsId !== null) {
    if (shortsId.length === 0) {
      return "Not a recognized YouTube URL";
    }
    return null;
  }

  return "Not a recognized YouTube URL";
}
