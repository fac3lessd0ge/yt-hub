import { useCallback, useRef, useState } from "react";
import { useSettings } from "@/hooks/useSettings";
import { getBaseUrl } from "@/lib/apiClient";
import { getFormatType } from "@/lib/formatType";
import { streamDownload } from "@/lib/sse";
import type {
  DownloadComplete,
  DownloadError,
  DownloadProgress,
  DownloadRequest,
} from "@/types/api";

type DownloadState = "idle" | "downloading" | "saving" | "complete" | "error";

export function useDownload() {
  const { settings } = useSettings();
  const [state, setState] = useState<DownloadState>("idle");
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [result, setResult] = useState<DownloadComplete | null>(null);
  const [localPath, setLocalPath] = useState<string | null>(null);
  const [error, setError] = useState<DownloadError | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(
    async (request: DownloadRequest) => {
      abortRef.current?.abort();

      setState("downloading");
      setProgress(null);
      setResult(null);
      setLocalPath(null);
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;

      let completeData: DownloadComplete | null = null;

      try {
        await streamDownload(
          request,
          {
            onProgress: (data) => {
              setProgress(data);
            },
            onComplete: (data) => {
              completeData = data;
              setResult(data);
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
        return;
      }

      if (!completeData) return;

      setState("saving");

      const data = completeData as DownloadComplete;
      const filename = data.download_url.split("/").pop() ?? "download";
      const fullUrl = `${getBaseUrl()}${data.download_url}`;

      try {
        const destDir = settings?.defaultDownloadDir ?? undefined;
        const saveResult = await window.electronAPI?.saveDownload(
          fullUrl,
          filename,
          destDir,
        );
        if (saveResult) {
          setLocalPath(saveResult.filePath);
          window.electronAPI?.addHistoryEntry({
            title: request.name,
            author: data.author_name ?? "",
            format: request.format,
            formatType: getFormatType(request.format),
            link: request.link,
            localPath: saveResult.filePath,
            downloadedAt: Date.now(),
          });
        }
      } catch (saveErr) {
        setError({
          code: "SAVE_FAILED",
          message:
            saveErr instanceof Error
              ? saveErr.message
              : "Failed to save file to disk",
        });
        setState("error");
        return;
      }

      setState("complete");
    },
    [settings?.defaultDownloadDir],
  );

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

  return {
    state,
    progress,
    result,
    localPath,
    error,
    start,
    cancel,
    reset,
  };
}
