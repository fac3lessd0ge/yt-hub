import { useCallback, useEffect, useRef, useState } from "react";
import { getFormatType } from "@/lib/formatType";
import type {
  DownloadComplete,
  DownloadError,
  DownloadProgress,
  DownloadRequest,
} from "@/types/api";

type DownloadState = "idle" | "downloading" | "complete" | "error";

export function useDownload() {
  const [state, setState] = useState<DownloadState>("idle");
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [result, setResult] = useState<DownloadComplete | null>(null);
  const [localPath, setLocalPath] = useState<string | null>(null);
  const [error, setError] = useState<DownloadError | null>(null);

  // Active download id and its event unsubscribers.
  const downloadIdRef = useRef<string | null>(null);
  const unsubscribersRef = useRef<Array<() => void>>([]);
  const requestRef = useRef<DownloadRequest | null>(null);

  const cleanup = useCallback(() => {
    for (const unsub of unsubscribersRef.current) unsub();
    unsubscribersRef.current = [];
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(
    async (request: DownloadRequest) => {
      const api = window.electronAPI;

      // Generate the id NOW — before subscribing and before the IPC call —
      // so events arriving before invoke resolves are never lost.
      const downloadId = crypto.randomUUID();

      // Cancel any previous in-flight download synchronously (id is always known).
      cleanup();
      if (downloadIdRef.current) {
        api?.cancelDownload(downloadIdRef.current);
      }
      downloadIdRef.current = downloadId;

      setState("downloading");
      setProgress(null);
      setResult(null);
      setLocalPath(null);
      setError(null);
      requestRef.current = request;

      if (!api) {
        downloadIdRef.current = null;
        setError({
          code: "NETWORK_ERROR",
          message: "Electron bridge unavailable",
        });
        setState("error");
        return;
      }

      const offProgress = api.onDownloadProgress((payload) => {
        if (payload.downloadId !== downloadIdRef.current) return;
        setProgress({
          percent: payload.percent,
          speed: payload.speed,
          eta: payload.eta,
        });
      });

      const offComplete = api.onDownloadComplete((payload) => {
        if (payload.downloadId !== downloadIdRef.current) return;
        setResult(payload.result);
        setLocalPath(payload.filePath);
        setState("complete");
        const req = requestRef.current;
        if (req) {
          api.addHistoryEntry({
            title: payload.result.title || req.name,
            author: payload.result.author_name,
            format: req.format,
            formatType: getFormatType(req.format),
            link: req.link,
            localPath: payload.filePath,
            downloadedAt: Date.now(),
          });
        }
        cleanup();
        downloadIdRef.current = null;
      });

      const offError = api.onDownloadError((payload) => {
        if (payload.downloadId !== downloadIdRef.current) return;
        setError({ code: payload.code, message: payload.message });
        setState("error");
        cleanup();
        downloadIdRef.current = null;
      });

      unsubscribersRef.current = [offProgress, offComplete, offError];

      try {
        // downloadId is sent to main so it emits events under the same id.
        await api.startDownload({
          downloadId,
          link: request.link,
          format: request.format,
          name: request.name,
        });
      } catch (err) {
        cleanup();
        downloadIdRef.current = null;
        setError({
          code: "NETWORK_ERROR",
          message: err instanceof Error ? err.message : "Unknown error",
        });
        setState("error");
      }
    },
    [cleanup],
  );

  const cancel = useCallback(() => {
    cleanup();
    if (downloadIdRef.current) {
      window.electronAPI?.cancelDownload(downloadIdRef.current);
      downloadIdRef.current = null;
    }
    setState("idle");
  }, [cleanup]);

  const reset = useCallback(() => {
    cleanup();
    downloadIdRef.current = null;
    setState("idle");
    setProgress(null);
    setResult(null);
    setLocalPath(null);
    setError(null);
  }, [cleanup]);

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
