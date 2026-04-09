import type {
  BackendsResponse,
  FormatsResponse,
  MetadataResponse,
} from "@/types/api";

export const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
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
    throw new Error(message);
  }
  return response.json();
}

export function fetchMetadata(link: string): Promise<MetadataResponse> {
  return fetchJson(`${BASE_URL}/api/metadata?link=${encodeURIComponent(link)}`);
}

export function fetchFormats(): Promise<FormatsResponse> {
  return fetchJson(`${BASE_URL}/api/formats`);
}

export function fetchBackends(): Promise<BackendsResponse> {
  return fetchJson(`${BASE_URL}/api/backends`);
}

export function getDownloadUrl(): string {
  return `${BASE_URL}/api/downloads`;
}
