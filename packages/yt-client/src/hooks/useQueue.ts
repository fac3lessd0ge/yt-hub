import { useCallback, useEffect, useReducer, useRef } from "react";
import { getFormatType } from "@/lib/formatType";
import { getMediaSource } from "@/lib/urlValidation";
import type { DownloadError, DownloadRequest } from "@/types/api";

const MAX_CONCURRENT = 2;

export interface QueueItem {
  id: string;
  link: string;
  format: string;
  name: string;
  status: "pending" | "downloading" | "complete" | "error";
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
  | { type: "COMPLETE"; id: string; localPath: string | null; name?: string }
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
    case "COMPLETE":
      return state.map((item) =>
        item.id === action.id
          ? {
              ...item,
              status: "complete",
              localPath: action.localPath,
              name: action.name ?? item.name,
            }
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
  const [items, dispatch] = useReducer(queueReducer, []);
  const activeIds = useRef<Set<string>>(new Set());
  // downloadId (renderer-generated) → queue item id
  const downloadToItem = useRef<Map<string, string>>(new Map());
  // queue item id → downloadId
  const itemToDownload = useRef<Map<string, string>>(new Map());
  // queue item id → originating request (for history entries)
  const itemRequests = useRef<Map<string, DownloadRequest>>(new Map());

  // Subscribe once to the main → renderer download channels and route by id.
  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    const release = (itemId: string, downloadId: string) => {
      activeIds.current.delete(itemId);
      downloadToItem.current.delete(downloadId);
      itemToDownload.current.delete(itemId);
      itemRequests.current.delete(itemId);
    };

    const offProgress = api.onDownloadProgress((payload) => {
      const itemId = downloadToItem.current.get(payload.downloadId);
      if (!itemId) return;
      dispatch({
        type: "UPDATE_PROGRESS",
        id: itemId,
        progress: payload.percent,
        speed: payload.speed,
        eta: payload.eta,
      });
    });

    const offComplete = api.onDownloadComplete((payload) => {
      const itemId = downloadToItem.current.get(payload.downloadId);
      if (!itemId) return;
      const req = itemRequests.current.get(itemId);
      dispatch({
        type: "COMPLETE",
        id: itemId,
        localPath: payload.filePath,
        name: payload.result.title || req?.name,
      });
      if (req) {
        api.addHistoryEntry({
          title: payload.result.title || req.name,
          author: payload.result.author_name,
          format: req.format,
          formatType: getFormatType(req.format),
          link: req.link,
          localPath: payload.filePath,
          downloadedAt: Date.now(),
          source: getMediaSource(req.link) ?? "youtube",
        });
      }
      release(itemId, payload.downloadId);
    });

    const offError = api.onDownloadError((payload) => {
      const itemId = downloadToItem.current.get(payload.downloadId);
      if (!itemId) return;
      dispatch({
        type: "ERROR",
        id: itemId,
        error: {
          code: payload.code,
          message: payload.message,
          retryable: true,
        },
      });
      release(itemId, payload.downloadId);
    });

    return () => {
      offProgress();
      offComplete();
      offError();
    };
  }, []);

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
    const downloadId = itemToDownload.current.get(id);
    if (downloadId) {
      window.electronAPI?.cancelDownload(downloadId);
      downloadToItem.current.delete(downloadId);
      itemToDownload.current.delete(id);
    }
    activeIds.current.delete(id);
    itemRequests.current.delete(id);
    dispatch({ type: "CANCEL", id });
  }, []);

  const removeItem = useCallback((id: string) => {
    dispatch({ type: "REMOVE", id });
  }, []);

  const retryItem = useCallback((id: string) => {
    dispatch({ type: "RETRY", id });
  }, []);

  const startDownload = useCallback(async (item: QueueItem) => {
    if (activeIds.current.has(item.id)) return;
    const api = window.electronAPI;
    if (!api) {
      dispatch({
        type: "ERROR",
        id: item.id,
        error: {
          code: "NETWORK_ERROR",
          message: "Electron bridge unavailable",
          retryable: true,
        },
      });
      return;
    }

    // Generate the downloadId NOW — before the async IPC call — so events
    // arriving before startDownload resolves are never dropped.
    const downloadId = crypto.randomUUID();

    activeIds.current.add(item.id);
    downloadToItem.current.set(downloadId, item.id);
    itemToDownload.current.set(item.id, downloadId);

    const request: DownloadRequest = {
      link: item.link,
      format: item.format,
      name: item.name,
    };
    itemRequests.current.set(item.id, request);

    dispatch({ type: "START_DOWNLOAD", id: item.id });

    try {
      // Pass the renderer-generated id so main emits events under the same id.
      await api.startDownload({ downloadId, ...request });
    } catch (err) {
      activeIds.current.delete(item.id);
      downloadToItem.current.delete(downloadId);
      itemToDownload.current.delete(item.id);
      itemRequests.current.delete(item.id);
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
  }, []);

  // Concurrency manager: fill slots when pending items exist.
  useEffect(() => {
    const activeCount = items.filter((i) => i.status === "downloading").length;
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
