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
  onReconnecting?: (attempt: number) => void;
}

const MAX_RECONNECTS = 3;
const BASE_RECONNECT_DELAY_MS = 1000;

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

/**
 * Read an SSE stream, dispatching callbacks for each event.
 * Returns true if a terminal event (complete/error) was received.
 */
async function readStream(
  body: ReadableStream<Uint8Array>,
  callbacks: SseCallbacks,
): Promise<boolean> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let terminal = false;

  try {
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

        let parsed: unknown;
        try {
          parsed = JSON.parse(data);
        } catch {
          callbacks.onError({
            code: "PARSE_ERROR",
            message: `Failed to parse SSE event: ${data.slice(0, 200)}`,
          });
          continue;
        }
        switch (eventType) {
          case "progress":
            callbacks.onProgress(parsed as DownloadProgress);
            break;
          case "complete":
            callbacks.onComplete(parsed as DownloadComplete);
            terminal = true;
            break;
          case "error":
            callbacks.onError(parsed as DownloadError);
            terminal = true;
            break;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return terminal;
}

export async function streamDownload(
  request: DownloadRequest,
  callbacks: SseCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  let attempt = 0;

  while (attempt <= MAX_RECONNECTS) {
    try {
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

      const terminal = await readStream(response.body, callbacks);
      if (terminal) return;

      // Stream ended without terminal event — treat as drop
      attempt++;
      if (attempt > MAX_RECONNECTS) {
        callbacks.onError({
          code: "CONNECTION_LOST",
          message: "Download stream lost after multiple reconnect attempts",
        });
        return;
      }
      callbacks.onReconnecting?.(attempt);
      await delay(BASE_RECONNECT_DELAY_MS * 2 ** (attempt - 1), signal);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      if (err instanceof Error && err.name === "AbortError") throw err;

      attempt++;
      if (attempt > MAX_RECONNECTS) {
        callbacks.onError({
          code: "CONNECTION_LOST",
          message: "Download stream lost after multiple reconnect attempts",
        });
        return;
      }
      callbacks.onReconnecting?.(attempt);
      await delay(BASE_RECONNECT_DELAY_MS * 2 ** (attempt - 1), signal);
    }
  }
}
