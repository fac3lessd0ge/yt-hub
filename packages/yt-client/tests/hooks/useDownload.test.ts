import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDownload } from "@/hooks/useDownload";

const mockStreamDownload = vi.fn();

vi.mock("@/lib/sse", () => ({
  streamDownload: (...args: any[]) => mockStreamDownload(...args),
}));

vi.mock("@/lib/apiClient", () => ({
  getBaseUrl: () => "http://localhost:3000",
}));

describe("useDownload", () => {
  beforeEach(() => {
    mockStreamDownload.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
  it("starts in idle state", () => {
    const { result } = renderHook(() => useDownload());

    expect(result.current.state).toBe("idle");
    expect(result.current.progress).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("transitions from idle to downloading when start is called", async () => {
    mockStreamDownload.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useDownload());

    act(() => {
      result.current.start({
        link: "https://youtube.com/watch?v=abc",
        format: "mp3",
        name: "test",
      });
    });

    await waitFor(() => {
      expect(result.current.state).toBe("downloading");
    });
  });

  it("transitions to complete when onComplete callback fires", async () => {
    const completeData = {
      output_path: "/tmp/test.mp3",
      download_url: "/api/downloads/test.mp3",
      title: "Video",
      author_name: "Author",
      format_id: "mp3",
      format_label: "MP3 audio",
    };

    mockStreamDownload.mockImplementation(
      async (_request: any, callbacks: any) => {
        callbacks.onComplete(completeData);
      },
    );

    const { result } = renderHook(() => useDownload());

    await act(async () => {
      await result.current.start({
        link: "https://youtube.com/watch?v=abc",
        format: "mp3",
        name: "test",
      });
    });

    expect(result.current.state).toBe("complete");
    expect(result.current.result).toEqual(completeData);
  });

  it("updates progress when onProgress callback fires", async () => {
    const progressData = { percent: 50, speed: "2.0MiB/s", eta: "00:05" };

    mockStreamDownload.mockImplementation(
      async (_request: any, callbacks: any) => {
        callbacks.onProgress(progressData);
        callbacks.onComplete({
          output_path: "/tmp/test.mp3",
          download_url: "/api/downloads/test.mp3",
          title: "V",
          author_name: "A",
          format_id: "mp3",
          format_label: "MP3",
        });
      },
    );

    const { result } = renderHook(() => useDownload());

    await act(async () => {
      await result.current.start({
        link: "https://youtube.com/watch?v=abc",
        format: "mp3",
        name: "test",
      });
    });

    expect(result.current.progress).toEqual(progressData);
  });

  it("transitions to error when onError callback fires", async () => {
    const errorData = { code: "DOWNLOAD_FAILED", message: "Backend crashed" };

    mockStreamDownload.mockImplementation(
      async (_request: any, callbacks: any) => {
        callbacks.onError(errorData);
      },
    );

    const { result } = renderHook(() => useDownload());

    await act(async () => {
      await result.current.start({
        link: "https://youtube.com/watch?v=abc",
        format: "mp3",
        name: "test",
      });
    });

    expect(result.current.state).toBe("error");
    expect(result.current.error).toEqual(errorData);
  });

  it("transitions to error with NETWORK_ERROR when streamDownload throws", async () => {
    mockStreamDownload.mockRejectedValue(new Error("fetch failed"));

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
      message: "fetch failed",
    });
  });

  it("resets to idle state when reset is called", async () => {
    const errorData = { code: "DOWNLOAD_FAILED", message: "Failed" };
    mockStreamDownload.mockImplementation(
      async (_request: any, callbacks: any) => {
        callbacks.onError(errorData);
      },
    );

    const { result } = renderHook(() => useDownload());

    await act(async () => {
      await result.current.start({
        link: "https://youtube.com/watch?v=abc",
        format: "mp3",
        name: "test",
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

  it("transitions to error with SAVE_FAILED when save throws", async () => {
    const completeData = {
      output_path: "/tmp/test.mp3",
      download_url: "/api/downloads/test.mp3",
      title: "Video",
      author_name: "Author",
      format_id: "mp3",
      format_label: "MP3 audio",
    };

    mockStreamDownload.mockImplementation(
      async (_request: any, callbacks: any) => {
        callbacks.onComplete(completeData);
      },
    );

    vi.stubGlobal("window", {
      ...window,
      electronAPI: {
        saveDownload: vi.fn().mockRejectedValue(new Error("Disk full")),
      },
    });

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
      code: "SAVE_FAILED",
      message: "Disk full",
    });

    vi.unstubAllGlobals();
  });

  it("returns to idle state when abort occurs", async () => {
    mockStreamDownload.mockImplementation(
      async (_request: any, _callbacks: any, _signal: AbortSignal) => {
        const abortError = new Error("Aborted");
        abortError.name = "AbortError";
        throw abortError;
      },
    );

    const { result } = renderHook(() => useDownload());

    await act(async () => {
      await result.current.start({
        link: "https://youtube.com/watch?v=abc",
        format: "mp3",
        name: "test",
      });
    });

    expect(result.current.state).toBe("idle");
  });

  it("aborts the previous controller when start is called concurrently", async () => {
    let firstSignal: AbortSignal | undefined;

    mockStreamDownload.mockImplementation(
      (_request: any, _callbacks: any, signal: AbortSignal) => {
        if (!firstSignal) {
          firstSignal = signal;
          // First call: never resolve (simulates in-progress download)
          return new Promise(() => {});
        }
        // Second call: resolve immediately
        return Promise.resolve();
      },
    );

    const { result } = renderHook(() => useDownload());

    // Start first download (does not await — it hangs)
    act(() => {
      result.current.start({
        link: "https://youtube.com/watch?v=first",
        format: "mp3",
        name: "first",
      });
    });

    await waitFor(() => {
      expect(result.current.state).toBe("downloading");
    });

    expect(firstSignal).toBeDefined();
    expect(firstSignal?.aborted).toBe(false);

    // Start second download — should abort the first
    await act(async () => {
      await result.current.start({
        link: "https://youtube.com/watch?v=second",
        format: "mp3",
        name: "second",
      });
    });

    expect(firstSignal?.aborted).toBe(true);
  });

  it("runs save logic after streamDownload resolves (downloading → saving → complete)", async () => {
    const stateTransitions: string[] = [];

    const completeData = {
      output_path: "/tmp/test.mp3",
      download_url: "/api/downloads/test.mp3",
      title: "Video",
      author_name: "Author",
      format_id: "mp3",
      format_label: "MP3 audio",
    };

    vi.stubGlobal("window", {
      ...window,
      electronAPI: {
        saveDownload: vi
          .fn()
          .mockResolvedValue({ filePath: "/saved/test.mp3" }),
        addHistoryEntry: vi.fn().mockResolvedValue({}),
      },
    });

    mockStreamDownload.mockImplementation(
      async (_request: any, callbacks: any) => {
        stateTransitions.push("streamDownload:before-complete");
        callbacks.onComplete(completeData);
        stateTransitions.push("streamDownload:after-complete");
        // onComplete is synchronous — save logic should NOT have run yet
      },
    );

    const { result } = renderHook(() => useDownload());

    await act(async () => {
      await result.current.start({
        link: "https://youtube.com/watch?v=abc",
        format: "mp3",
        name: "test",
      });
    });

    // Save should have been called after streamDownload resolved
    expect(window.electronAPI?.saveDownload).toHaveBeenCalledWith(
      "http://localhost:3000/api/downloads/test.mp3",
      "test.mp3",
      undefined,
    );

    expect(result.current.state).toBe("complete");
    expect(result.current.localPath).toBe("/saved/test.mp3");
    expect(result.current.result).toEqual(completeData);

    vi.unstubAllGlobals();
  });
});
