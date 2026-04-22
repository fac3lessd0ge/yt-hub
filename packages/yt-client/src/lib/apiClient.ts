import type {
  BackendsResponse,
  FormatsResponse,
  MetadataResponse,
} from "@/types/api";
import { HttpError, RateLimitError, withRetry } from "./retry";

function stripTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Electron: preload exposes `YT_HUB_API_URL` from the main process (dev-friendly override).
 * Packaged apps bake `VITE_API_BASE_URL` at build time; if the OS still has
 * `YT_HUB_API_URL=http://localhost:3000` from local dev, using that first would break prod.
 *
 * - **DEV** (`vite` / `electron-forge start`): prefer env override, then Vite env.
 * - **PROD** (packaged): prefer baked `VITE_API_BASE_URL`, then override.
 */
export function getBaseUrl(): string {
  const viteUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  const electronUrl =
    typeof window !== "undefined"
      ? window.electronAPI?.getApiBaseUrl?.()?.trim()
      : undefined;

  if (import.meta.env.DEV) {
    if (electronUrl) return stripTrailingSlashes(electronUrl);
    if (viteUrl) return stripTrailingSlashes(viteUrl);
  } else {
    if (viteUrl) return stripTrailingSlashes(viteUrl);
    if (electronUrl) return stripTrailingSlashes(electronUrl);
  }
  return "http://localhost:3000";
}

export function parseRetryAfter(header: string | null): number {
  if (!header) return 5000;
  const seconds = Number(header);
  if (!Number.isNaN(seconds)) return seconds * 1000;
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return 5000;
}

async function fetchJson<T>(
  url: string,
  options?: { signal?: AbortSignal },
): Promise<T> {
  return withRetry(
    async () => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("You are offline. Please check your connection.");
      }
      const response = await fetch(url, { signal: options?.signal });
      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          throw new RateLimitError(parseRetryAfter(retryAfter));
        }
        let message = `HTTP ${response.status}`;
        try {
          const text = await response.text();
          try {
            const body = JSON.parse(text);
            if (body.message) message = body.message;
          } catch {
            if (text) message = text.slice(0, 500);
          }
        } catch {
          // Body unreadable, use default message
        }
        throw new HttpError(response.status, message);
      }
      return response.json();
    },
    { signal: options?.signal },
  );
}

export function fetchMetadata(
  link: string,
  options?: { signal?: AbortSignal },
): Promise<MetadataResponse> {
  return fetchJson(
    `${getBaseUrl()}/api/metadata?link=${encodeURIComponent(link)}`,
    options,
  );
}

export function fetchFormats(): Promise<FormatsResponse> {
  return fetchJson(`${getBaseUrl()}/api/formats`);
}

export function fetchBackends(): Promise<BackendsResponse> {
  return fetchJson(`${getBaseUrl()}/api/backends`);
}

export function getDownloadUrl(): string {
  return `${getBaseUrl()}/api/downloads`;
}
