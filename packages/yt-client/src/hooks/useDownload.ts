import { useCallback, useRef, useState } from "react";
import { BASE_URL } from "@/lib/apiClient";
import { streamDownload } from "@/lib/sse";
import type {
  DownloadComplete,
  DownloadError,
  DownloadProgress,
  DownloadRequest,
} from "@/types/api";

type DownloadState = "idle" | "downloading" | "saving" | "complete" | "error";

export function useDownload() {
  const [state, setState] = useState<DownloadState>("idle");
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [result, setResult] = useState<DownloadComplete | null>(null);
  const [localPath, setLocalPath] = useState<string | null>(null);
  const [error, setError] = useState<DownloadError | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async (request: DownloadRequest) => {
    setState("downloading");
    setProgress(null);
    setResult(null);
    setLocalPath(null);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamDownload(
        request,
        {
          onProgress: (data) => setProgress(data),
          onComplete: async (data) => {
            setResult(data);
            setState("saving");

            const filename =
              data.download_url.split("/").pop() ?? "download";
            const fullUrl = `${BASE_URL}${data.download_url}`;

            try {
              const saveResult =
                await window.electronAPI?.saveDownload(fullUrl, filename);
              if (saveResult) {
                setLocalPath(saveResult.filePath);
              }
            } catch {
              // Save failed — still show complete with server info
            }
            setState("complete");
          },
          onError: (data) => {
            setError(data);
            setState("error");
          },
        },
        controller.signal,
      );
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setState("idle");
      } else {
        setError({
          code: "NETWORK_ERROR",
          message: err instanceof Error ? err.message : "Unknown error",
        });
        setState("error");
      }
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    setState("idle");
    setProgress(null);
    setResult(null);
    setLocalPath(null);
    setError(null);
  }, []);

  return { state, progress, result, localPath, error, start, cancel, reset };
}
