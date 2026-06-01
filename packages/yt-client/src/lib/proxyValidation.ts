/** Proxy schemes yt-dlp understands. */
const ALLOWED_PROXY_SCHEMES = new Set([
  "http:",
  "https:",
  "socks:",
  "socks4:",
  "socks5:",
  "socks5h:",
]);

/**
 * Validate a download proxy string.
 *
 * An empty string means "no proxy" (direct) and is valid. Otherwise the value
 * must be a full URL with a scheme yt-dlp supports and a host, e.g.
 * `socks5://127.0.0.1:2080` or `http://user:pass@host:8080`.
 *
 * @returns an error message, or `null` when the value is acceptable.
 */
export function getProxyValidationError(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return "Enter a full proxy URL, e.g. socks5://127.0.0.1:2080";
  }

  if (!ALLOWED_PROXY_SCHEMES.has(url.protocol)) {
    return "Proxy must start with socks5://, http://, or https://";
  }

  if (!url.hostname) {
    return "Proxy is missing a host";
  }

  return null;
}
