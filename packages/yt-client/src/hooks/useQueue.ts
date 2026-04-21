import { useCallback, useEffect, useReducer, useRef } from "react";
import { useSettings } from "@/hooks/useSettings";
import {
  resolveDownloadFetchUrl,
  suggestedDownloadFilename,
} from "@/lib/downloadArtifact";
import { getFormatType } from "@/lib/formatType";
import { streamDownload } from "@/lib/sse";
import type {
  DownloadComplete,
  DownloadError,
  DownloadProgress,
  DownloadRequest,
} from "@/types/api";

const MAX_CONCURRENT = 2;

export interface QueueItem {
  id: string;
  link: string;
  format: string;
  name: string;
  status: "pending" | "downloading" | "saving" | "complete" | "error";
  progress: number | null;
  speed: string | null;
  eta: string | null;
  error: { code: string; message: string; retryable?: boolean } | null;
  localPath: string | null;
  addedAt: number;
}

type QueueAction =
  | { type: "ADD_ITEM"; item: QueueItem }
  | { type: "START_DOWNLOAD"; id: string }
  | {
      type: "UPDATE_PROGRESS";
      id: string;
      progress: number;
      speed: string | null;
      eta: string | null;
    }
  | { type: "SAVE_STARTED"; id: string }
  | { type: "COMPLETE"; id: string; localPath: string | null }
  | { type: "ERROR"; id: string; error: DownloadError }
  | { type: "CANCEL"; id: string }
  | { type: "REMOVE"; id: string }
  | { type: "RETRY"; id: string }
  | { type: "UPDATE_NAME"; id: string; name: string };

function queueReducer(state: QueueItem[], action: QueueAction): QueueItem[] {
  switch (action.type) {
    case "ADD_ITEM":
      return [...state, action.item];
    case "START_DOWNLOAD":
      return state.map((item) =>
        item.id === action.id
          ? { ...item, status: "downloading", error: null }
          : item,
      );
    case "UPDATE_PROGRESS":
      return state.map((item) =>
        item.id === action.id
          ? {
              ...item,
              progress: action.progress,
              speed: action.speed,
              eta: action.eta,
            }
          : item,
      );
    case "SAVE_STARTED":
      return state.map((item) =>
        item.id === action.id ? { ...item, status: "saving" } : item,
      );
    case "COMPLETE":
      return state.map((item) =>
        item.id === action.id
          ? { ...item, status: "complete", localPath: action.localPath }
          : item,
      );
    case "ERROR":
      return state.map((item) =>
        item.id === action.id
          ? { ...item, status: "error", error: action.error }
          : item,
      );
    case "CANCEL":
      return state.filter((item) => item.id !== action.id);
    case "REMOVE":
      return state.filter((item) => item.id !== action.id);
    case "RETRY":
      return state.map((item) =>
        item.id === action.id
          ? {
              ...item,
              status: "pending",
              progress: null,
              speed: null,
              eta: null,
              error: null,
            }
          : item,
      );
    case "UPDATE_NAME":
      return state.map((item) =>
        item.id === action.id ? { ...item, name: action.name } : item,
      );
    default:
      return state;
  }
}

export function useQueue() {
  const { settings } = useSettings();
  const [items, dispatch] = useReducer(queueReducer, []);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());
  const activeIds = useRef<Set<string>>(new Set());

  const addItem = useCallback((request: DownloadRequest) => {
    const item: QueueItem = {
      id: crypto.randomUUID(),
      link: request.link,
      format: request.format,
      name: request.name,
      status: "pending",
      progress: null,
      speed: null,
      eta: null,
      error: null,
      localPath: null,
      addedAt: Date.now(),
    };
    dispatch({ type: "ADD_ITEM", item });
  }, []);

  const updateItemName = useCallback((id: string, name: string) => {
    dispatch({ type: "UPDATE_NAME", id, name });
  }, []);

  const cancelItem = useCallback((id: string) => {
    const controller = abortControllers.current.get(id);
    if (controller) {
      controller.abort();
      abortControllers.current.delete(id);
    }
    activeIds.current.delete(id);
    dispatch({ type: "CANCEL", id });
  }, []);

  const removeItem = useCallback((id: string) => {
    dispatch({ type: "REMOVE", id });
  }, []);

  const retryItem = useCallback((id: string) => {
    dispatch({ type: "RETRY", id });
  }, []);

  const startDownload = useCallback(
    async (item: QueueItem) => {
      if (activeIds.current.has(item.id)) return;
      activeIds.current.add(item.id);

      const controller = new AbortController();
      abortControllers.current.set(item.id, controller);

      dispatch({ type: "START_DOWNLOAD", id: item.id });

      const request: DownloadRequest = {
        link: item.link,
        format: item.format,
        name: item.name,
      };

      let completeData: DownloadComplete | null = null;

      try {
        await streamDownload(
          request,
          {
            onProgress: (data: DownloadProgress) => {
              dispatch({
                type: "UPDATE_PROGRESS",
                id: item.id,
                progress: data.percent,
                speed: data.speed,
                eta: data.eta,
              });
            },
            onComplete: (data: DownloadComplete) => {
              completeData = data;
              if (data.title) {
                dispatch({
                  type: "UPDATE_NAME",
                  id: item.id,
                  name: data.title,
                });
              }
            },
            onError: (data: DownloadError) => {
              dispatch({
                type: "ERROR",
                id: item.id,
                error: { ...data, retryable: data.retryable ?? true },
              });
              activeIds.current.delete(item.id);
              abortControllers.current.delete(item.id);
            },
          },
          controller.signal,
        );
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // Cancelled — already handled by cancelItem
        } else {
          dispatch({
            type: "ERROR",
            id: item.id,
            error: {
              code: "NETWORK_ERROR",
              message: err instanceof Error ? err.message : "Unknown error",
              retryable: true,
            },
          });
        }
        activeIds.current.delete(item.id);
        abortControllers.current.delete(item.id);
        return;
      }

      if (!completeData) {
        activeIds.current.delete(item.id);
        abortControllers.current.delete(item.id);
        return;
      }

      dispatch({ type: "SAVE_STARTED", id: item.id });

      const data = completeData as DownloadComplete;
      const filename = suggestedDownloadFilename(data);
      const fullUrl = resolveDownloadFetchUrl(data);
      const destDir = settings?.defaultDownloadDir ?? undefined;

      try {
        const saveResult = await window.electronAPI?.saveDownload(
          fullUrl,
          filename,
          destDir,
        );
        dispatch({
          type: "COMPLETE",
          id: item.id,
          localPath: saveResult?.filePath ?? null,
        });

        if (saveResult?.filePath) {
          window.electronAPI?.addHistoryEntry({
            title: data.title || item.name,
            author: data.author_name ?? "",
            format: item.format,
            formatType: getFormatType(item.format),
            link: item.link,
            localPath: saveResult.filePath,
            downloadedAt: Date.now(),
          });
        }
      } catch (saveErr) {
        dispatch({
          type: "ERROR",
          id: item.id,
          error: {
            code: "SAVE_FAILED",
            message:
              saveErr instanceof Error
                ? saveErr.message
                : "Failed to save file to disk",
            retryable: true,
          },
        });
      }

      activeIds.current.delete(item.id);
      abortControllers.current.delete(item.id);
    },
    [settings?.defaultDownloadDir],
  );

  // Concurrency manager: fill slots when pending items exist
  useEffect(() => {
    const activeCount = items.filter(
      (i) => i.status === "downloading" || i.status === "saving",
    ).length;
    const pendingItems = items.filter((i) => i.status === "pending");
    const slotsAvailable = MAX_CONCURRENT - activeCount;

    for (let i = 0; i < Math.min(slotsAvailable, pendingItems.length); i++) {
      startDownload(pendingItems[i]);
    }
  }, [items, startDownload]);

  return {
    items,
    addItem,
    updateItemName,
    cancelItem,
    removeItem,
    retryItem,
  };
}
