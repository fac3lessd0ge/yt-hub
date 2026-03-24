import type {
  DownloadComplete,
  DownloadError,
  DownloadProgress,
  DownloadRequest,
} from "@/types/api";
import { getDownloadUrl } from "./apiClient";

export interface SseCallbacks {
  onProgress: (data: DownloadProgress) => void;
  onComplete: (data: DownloadComplete) => void;
  onError: (data: DownloadError) => void;
}

export async function streamDownload(
  request: DownloadRequest,
  callbacks: SseCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(getDownloadUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok || !response.body) {
    callbacks.onError({
      code: "HTTP_ERROR",
      message: `Request failed with status ${response.status}`,
    });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const part of parts) {
      const lines = part.split("\n");
      let eventType = "";
      let data = "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7);
        } else if (line.startsWith("data: ")) {
          data = line.slice(6);
        }
      }

      if (!eventType || !data) continue;

      const parsed = JSON.parse(data);
      switch (eventType) {
        case "progress":
          callbacks.onProgress(parsed);
          break;
        case "complete":
          callbacks.onComplete(parsed);
          break;
        case "error":
          callbacks.onError(parsed);
          break;
      }
    }
  }
}
