import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDownload } from "@/hooks/useDownload";
import type {
  DownloadCompleteEvent,
  DownloadErrorEvent,
  DownloadProgressEvent,
} from "@/types/api";

vi.mock("@/hooks/useSettings", () => ({
  useSettings: () => ({ settings: { defaultDownloadDir: null } }),
}));

// Captured event emitters — fire from tests to simulate main → renderer events.
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

const completeResult = {
  output_path: "/saved/test.mp3",
  title: "Video",
  author_name: "Author",
  format_id: "mp3",
  format_label: "MP3 audio",
};

describe("useDownload", () => {
  beforeEach(() => {
    progressCb = null;
    completeCb = null;
    errorCb = null;
    // startDownload now returns void (no downloadId)
    startDownload.mockReset().mockResolvedValue(undefined);
    cancelDownload.mockReset();
    addHistoryEntry.mockReset();
    stubApi();
  });

  afterEach(() => {
    (window as unknown as { electronAPI?: unknown }).electronAPI = undefined;
  });

  it("starts in idle state", () => {
    const { result } = renderHook(() => useDownload());

    expect(result.current.state).toBe("idle");
    expect(result.current.progress).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("transitions from idle to downloading when start is called", async () => {
    const { result } = renderHook(() => useDownload());

    await act(async () => {
      await result.current.start({
        link: "https://youtube.com/watch?v=abc",
        format: "mp3",
        name: "test",
      });
    });

    expect(result.current.state).toBe("downloading");
    // Renderer generates downloadId and sends it in params (no destination)
    expect(startDownload).toHaveBeenCalledWith(
      expect.objectContaining({
        link: "https://youtube.com/watch?v=abc",
        format: "mp3",
        name: "test",
        downloadId: expect.any(String),
      }),
    );
  });

  it("renderer generates downloadId before IPC call and events are routed by it", async () => {
    let capturedDownloadId: string | undefined;
    startDownload.mockImplementation((params: { downloadId: string }) => {
      capturedDownloadId = params.downloadId;
      return Promise.resolve();
    });

    const { result } = renderHook(() => useDownload());

    await act(async () => {
      await result.current.start({
        link: "https://youtube.com/watch?v=abc",
        format: "mp3",
        name: "test",
      });
    });

    expect(capturedDownloadId).toBeDefined();

    act(() => {
      completeCb?.({
        downloadId: capturedDownloadId as string,
        filePath: "/saved/test.mp3",
        result: completeResult,
      });
    });

    expect(result.current.state).toBe("complete");
    expect(result.current.localPath).toBe("/saved/test.mp3");
  });

  it("updates progress when a progress event fires for the active download", async () => {
    let capturedDownloadId: string | undefined;
    startDownload.mockImplementation((params: { downloadId: string }) => {
      capturedDownloadId = params.downloadId;
      return Promise.resolve();
    });

    const { result } = renderHook(() => useDownload());

    await act(async () => {
      await result.current.start({
        link: "https://youtube.com/watch?v=abc",
        format: "mp3",
        name: "test",
      });
    });

    act(() => {
      progressCb?.({
        downloadId: capturedDownloadId as string,
        percent: 50,
        speed: "2.0MiB/s",
        eta: "00:05",
      });
    });

    expect(result.current.progress).toEqual({
      percent: 50,
      speed: "2.0MiB/s",
      eta: "00:05",
    });
  });

  it("ignores events for a different downloadId", async () => {
    const { result } = renderHook(() => useDownload());

    await act(async () => {
      await result.current.start({
        link: "https://youtube.com/watch?v=abc",
        format: "mp3",
        name: "test",
      });
    });

    act(() => {
      progressCb?.({
        downloadId: "other-unrelated-id",
        percent: 99,
        speed: "x",
        eta: "y",
      });
    });

    expect(result.current.progress).toBeNull();
  });

  it("transitions to complete and writes a history entry on completion", async () => {
    let capturedDownloadId: string | undefined;
    startDownload.mockImplementation((params: { downloadId: string }) => {
      capturedDownloadId = params.downloadId;
      return Promise.resolve();
    });

    const { result } = renderHook(() => useDownload());

    await act(async () => {
      await result.current.start({
        link: "https://youtube.com/watch?v=abc",
        format: "mp3",
        name: "test",
      });
    });

    act(() => {
      completeCb?.({
        downloadId: capturedDownloadId as string,
        filePath: "/saved/test.mp3",
        result: completeResult,
      });
    });

    expect(result.current.state).toBe("complete");
    expect(result.current.result).toEqual(completeResult);
    expect(result.current.localPath).toBe("/saved/test.mp3");
    expect(addHistoryEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Video",
        author: "Author",
        format: "mp3",
        formatType: "audio",
        link: "https://youtube.com/watch?v=abc",
        localPath: "/saved/test.mp3",
      }),
    );
  });

  it("transitions to error when an error event fires", async () => {
    let capturedDownloadId: string | undefined;
    startDownload.mockImplementation((params: { downloadId: string }) => {
      capturedDownloadId = params.downloadId;
      return Promise.resolve();
    });

    const { result } = renderHook(() => useDownload());

    await act(async () => {
      await result.current.start({
        link: "https://youtube.com/watch?v=abc",
        format: "mp3",
        name: "test",
      });
    });

    act(() => {
      errorCb?.({
        downloadId: capturedDownloadId as string,
        code: "DOWNLOAD_FAILED",
        message: "Backend crashed",
      });
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error).toEqual({
      code: "DOWNLOAD_FAILED",
      message: "Backend crashed",
    });
  });

  it("transitions to error with NETWORK_ERROR when startDownload rejects", async () => {
    startDownload.mockRejectedValueOnce(new Error("ipc failed"));

    const { result } = renderHook(() => useDownload());

    await act(async () => {
      await result.current.start({
        link: "https://youtube.com/watch?v=abc",
        format: "mp3",
        name: "test",
      });
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error).toEqual({
      code: "NETWORK_ERROR",
      message: "ipc failed",
    });
  });

  it("resets to idle state when reset is called", async () => {
    let capturedDownloadId: string | undefined;
    startDownload.mockImplementation((params: { downloadId: string }) => {
      capturedDownloadId = params.downloadId;
      return Promise.resolve();
    });

    const { result } = renderHook(() => useDownload());

    await act(async () => {
      await result.current.start({
        link: "https://youtube.com/watch?v=abc",
        format: "mp3",
        name: "test",
      });
    });

    act(() => {
      errorCb?.({
        downloadId: capturedDownloadId as string,
        code: "X",
        message: "Failed",
      });
    });
    expect(result.current.state).toBe("error");

    act(() => {
      result.current.reset();
    });

    expect(result.current.state).toBe("idle");
    expect(result.current.progress).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("cancels the active download and returns to idle", async () => {
    let capturedDownloadId: string | undefined;
    startDownload.mockImplementation((params: { downloadId: string }) => {
      capturedDownloadId = params.downloadId;
      return Promise.resolve();
    });

    const { result } = renderHook(() => useDownload());

    await act(async () => {
      await result.current.start({
        link: "https://youtube.com/watch?v=abc",
        format: "mp3",
        name: "test",
      });
    });

    act(() => {
      result.current.cancel();
    });

    expect(cancelDownload).toHaveBeenCalledWith(capturedDownloadId);
    expect(result.current.state).toBe("idle");
  });

  it("cancels the previous download synchronously when start is called again", async () => {
    const capturedIds: string[] = [];
    startDownload.mockImplementation((params: { downloadId: string }) => {
      capturedIds.push(params.downloadId);
      return Promise.resolve();
    });

    const { result } = renderHook(() => useDownload());

    await act(async () => {
      await result.current.start({
        link: "https://youtube.com/watch?v=first",
        format: "mp3",
        name: "first",
      });
    });

    await act(async () => {
      await result.current.start({
        link: "https://youtube.com/watch?v=second",
        format: "mp3",
        name: "second",
      });
    });

    expect(capturedIds).toHaveLength(2);
    // First id was cancelled when the second start ran
    expect(cancelDownload).toHaveBeenCalledWith(capturedIds[0]);
    await waitFor(() => {
      expect(result.current.state).toBe("downloading");
    });
  });
});
