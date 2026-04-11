import {
  DownloadCompleteSchema,
  DownloadErrorSchema,
  DownloadProgressSchema,
} from "@/types/api";
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
          case "progress": {
            const result = DownloadProgressSchema.safeParse(parsed);
            if (result.success) {
              callbacks.onProgress(result.data);
            } else {
              callbacks.onError({
                code: "PARSE_ERROR",
                message: `Invalid progress event: ${result.error.issues[0].message}`,
              });
            }
            break;
          }
          case "complete": {
            const result = DownloadCompleteSchema.safeParse(parsed);
            if (result.success) {
              callbacks.onComplete(result.data);
            } else {
              callbacks.onError({
                code: "PARSE_ERROR",
                message: `Invalid complete event: ${result.error.issues[0].message}`,
              });
            }
            terminal = true;
            break;
          }
          case "error": {
            const result = DownloadErrorSchema.safeParse(parsed);
            if (result.success) {
              callbacks.onError(result.data);
            } else {
              callbacks.onError({
                code: "PARSE_ERROR",
                message: `Invalid error event: ${result.error.issues[0].message}`,
              });
            }
            terminal = true;
            break;
          }
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
  if (!terminal) {
    // Stream ended without complete/error — connection was lost
    callbacks.onError({
      code: "CONNECTION_LOST",
      message: "Download stream interrupted. Please retry.",
      retryable: true,
    });
  }
}
