import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useQueue } from "@/hooks/useQueue";
import type {
  DownloadCompleteEvent,
  DownloadErrorEvent,
  DownloadProgressEvent,
} from "@/types/api";

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({ settings: { defaultDownloadDir: null } }),
}));

// Global event emitters — captured by the subscription helpers in the mock API.
// useQueue subscribes once on mount; we fire these to simulate main→renderer events.
let progressCb: ((p: DownloadProgressEvent) => void) | null = null;
let completeCb: ((p: DownloadCompleteEvent) => void) | null = null;
let errorCb: ((p: DownloadErrorEvent) => void) | null = null;

const startDownload = vi.fn();
const cancelDownload = vi.fn();
const addHistoryEntry = vi.fn();

function stubApi() {
  (window as unknown as { electronAPI: unknown }).electronAPI = {
    startDownload,
    cancelDownload,
    addHistoryEntry,
    onDownloadProgress: (cb: (p: DownloadProgressEvent) => void) => {
      progressCb = cb;
      return () => {
        progressCb = null;
      };
    },
    onDownloadComplete: (cb: (p: DownloadCompleteEvent) => void) => {
      completeCb = cb;
      return () => {
        completeCb = null;
      };
    },
    onDownloadError: (cb: (p: DownloadErrorEvent) => void) => {
      errorCb = cb;
      return () => {
        errorCb = null;
      };
    },
  };
}

const makeCompleteResult = (title = "Video", authorName = "Author") => ({
  output_path: "/saved/file.mp3",
  title,
  author_name: authorName,
  format_id: "mp3",
  format_label: "MP3 audio",
});

// Capture the downloadId that startDownload was called with for a given invocation.
function captureDownloadIds(): string[] {
  const ids: string[] = [];
  startDownload.mockImplementation((params: { downloadId: string }) => {
    ids.push(params.downloadId);
    return Promise.resolve();
  });
  return ids;
}

describe("useQueue", () => {
  beforeEach(() => {
    progressCb = null;
    completeCb = null;
    errorCb = null;
    startDownload.mockReset().mockResolvedValue(undefined);
    cancelDownload.mockReset();
    addHistoryEntry.mockReset();
    stubApi();
  });

  afterEach(() => {
    (window as unknown as { electronAPI?: unknown }).electronAPI = undefined;
  });

  // ── (a) MAX_CONCURRENT=2: two items start, third stays pending ────────────

  it("starts at most MAX_CONCURRENT downloads, leaving additional items pending", async () => {
    const ids = captureDownloadIds();
    const { result } = renderHook(() => useQueue());

    act(() => {
      result.current.addItem({
        link: "https://youtube.com/watch?v=a",
        format: "mp3",
        name: "A",
      });
      result.current.addItem({
        link: "https://youtube.com/watch?v=b",
        format: "mp3",
        name: "B",
      });
      result.current.addItem({
        link: "https://youtube.com/watch?v=c",
        format: "mp3",
        name: "C",
      });
    });

    await waitFor(() => {
      expect(startDownload).toHaveBeenCalledTimes(2);
    });

    expect(ids).toHaveLength(2);

    const statuses = result.current.items.map((i) => i.status);
    expect(statuses.filter((s) => s === "downloading")).toHaveLength(2);
    expect(statuses.filter((s) => s === "pending")).toHaveLength(1);
  });

  // ── (b) progress events route only to the correct item ───────────────────

  it("routes a progress event to the correct item and not to its sibling", async () => {
    const ids = captureDownloadIds();
    const { result } = renderHook(() => useQueue());

    act(() => {
      result.current.addItem({
        link: "https://youtube.com/watch?v=a",
        format: "mp3",
        name: "A",
      });
      result.current.addItem({
        link: "https://youtube.com/watch?v=b",
        format: "mp3",
        name: "B",
      });
    });

    await waitFor(() => expect(startDownload).toHaveBeenCalledTimes(2));
    expect(ids).toHaveLength(2);

    const [idA, idB] = ids;

    // Fire progress for item A only
    act(() => {
      progressCb?.({
        downloadId: idA,
        percent: 42,
        speed: "1MiB/s",
        eta: "00:10",
      });
    });

    const itemA = result.current.items.find((i) => i.name === "A");
    const itemB = result.current.items.find((i) => i.name === "B");

    expect(itemA?.progress).toBe(42);
    expect(itemB?.progress).toBeNull(); // B must not be updated

    // Fire progress for item B separately
    act(() => {
      progressCb?.({
        downloadId: idB,
        percent: 77,
        speed: "2MiB/s",
        eta: "00:05",
      });
    });

    const itemBUpdated = result.current.items.find((i) => i.name === "B");
    expect(itemBUpdated?.progress).toBe(77);
  });

  // ── (c) cancelItem removes both map entries and calls cancelDownload ──────

  it("cancelItem calls cancelDownload with the correct id and removes the item", async () => {
    const ids = captureDownloadIds();
    const { result } = renderHook(() => useQueue());

    act(() => {
      result.current.addItem({
        link: "https://youtube.com/watch?v=a",
        format: "mp3",
        name: "A",
      });
    });

    await waitFor(() => expect(startDownload).toHaveBeenCalledTimes(1));
    const [downloadId] = ids;

    const itemId = result.current.items[0].id;

    act(() => {
      result.current.cancelItem(itemId);
    });

    expect(cancelDownload).toHaveBeenCalledWith(downloadId);
    expect(result.current.items).toHaveLength(0);
  });

  // ── (d) complete event frees a slot so a pending item starts ─────────────

  it("frees a concurrency slot when a download completes, allowing the next pending item to start", async () => {
    const ids = captureDownloadIds();
    const { result } = renderHook(() => useQueue());

    act(() => {
      result.current.addItem({
        link: "https://youtube.com/watch?v=a",
        format: "mp3",
        name: "A",
      });
      result.current.addItem({
        link: "https://youtube.com/watch?v=b",
        format: "mp3",
        name: "B",
      });
      result.current.addItem({
        link: "https://youtube.com/watch?v=c",
        format: "mp3",
        name: "C",
      });
    });

    // Wait for the first two to start
    await waitFor(() => expect(startDownload).toHaveBeenCalledTimes(2));
    expect(
      result.current.items.filter((i) => i.status === "pending"),
    ).toHaveLength(1);

    // Complete item A — its slot should free up
    act(() => {
      completeCb?.({
        downloadId: ids[0],
        filePath: "/saved/a.mp3",
        result: makeCompleteResult("A"),
      });
    });

    // Third item (C) should now start
    await waitFor(() => expect(startDownload).toHaveBeenCalledTimes(3));

    expect(result.current.items.find((i) => i.name === "A")?.status).toBe(
      "complete",
    );
    expect(
      result.current.items.filter((i) => i.status === "downloading"),
    ).toHaveLength(2);
  });

  // ── (e) error event marks item retryable and frees the slot ──────────────

  it("marks an item as error (retryable) on download:error and frees the concurrency slot", async () => {
    const ids = captureDownloadIds();
    const { result } = renderHook(() => useQueue());

    act(() => {
      result.current.addItem({
        link: "https://youtube.com/watch?v=a",
        format: "mp3",
        name: "A",
      });
      result.current.addItem({
        link: "https://youtube.com/watch?v=b",
        format: "mp3",
        name: "B",
      });
      result.current.addItem({
        link: "https://youtube.com/watch?v=c",
        format: "mp3",
        name: "C",
      });
    });

    await waitFor(() => expect(startDownload).toHaveBeenCalledTimes(2));

    // Error out item A
    act(() => {
      errorCb?.({
        downloadId: ids[0],
        code: "BACKEND_CRASH",
        message: "yt-dlp exited with code 1",
      });
    });

    const itemA = result.current.items.find((i) => i.name === "A");
    expect(itemA?.status).toBe("error");
    expect(itemA?.error?.code).toBe("BACKEND_CRASH");
    expect(itemA?.error?.retryable).toBe(true);

    // Slot freed — item C should start
    await waitFor(() => expect(startDownload).toHaveBeenCalledTimes(3));
    expect(result.current.items.find((i) => i.name === "C")?.status).toBe(
      "downloading",
    );
  });

  // ── addHistoryEntry is called on complete ────────────────────────────────

  it("writes a history entry when a download completes", async () => {
    const ids = captureDownloadIds();
    const { result } = renderHook(() => useQueue());

    act(() => {
      result.current.addItem({
        link: "https://youtube.com/watch?v=a",
        format: "mp3",
        name: "A",
      });
    });

    await waitFor(() => expect(startDownload).toHaveBeenCalledTimes(1));

    act(() => {
      completeCb?.({
        downloadId: ids[0],
        filePath: "/saved/a.mp3",
        result: makeCompleteResult("My Song", "Cool Artist"),
      });
    });

    expect(addHistoryEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "My Song",
        author: "Cool Artist",
        format: "mp3",
        formatType: "audio",
        link: "https://youtube.com/watch?v=a",
        localPath: "/saved/a.mp3",
        source: "youtube",
      }),
    );
  });
});
