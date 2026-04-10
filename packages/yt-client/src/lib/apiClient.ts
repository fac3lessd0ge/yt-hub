import type {
  BackendsResponse,
  FormatsResponse,
  MetadataResponse,
} from "@/types/api";
import { HttpError, RateLimitError, withRetry } from "./retry";

export function getBaseUrl(): string {
  if (typeof window !== "undefined" && window.electronAPI?.getApiBaseUrl) {
    const url = window.electronAPI.getApiBaseUrl();
    if (url) return url;
  }
  return import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
}

export function parseRetryAfter(header: string | null): number {
  if (!header) return 5000;
  const seconds = Number(header);
  if (!Number.isNaN(seconds)) return seconds * 1000;
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return 5000;
}

async function fetchJson<T>(url: string): Promise<T> {
  return withRetry(async () => {
    const response = await fetch(url);
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
  });
}

export function fetchMetadata(link: string): Promise<MetadataResponse> {
  return fetchJson(
    `${getBaseUrl()}/api/metadata?link=${encodeURIComponent(link)}`,
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
