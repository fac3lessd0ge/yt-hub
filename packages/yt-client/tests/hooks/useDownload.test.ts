import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDownload } from "@/hooks/useDownload";

const mockStreamDownload = vi.fn();

vi.mock("@/lib/sse", () => ({
  streamDownload: (...args: any[]) => mockStreamDownload(...args),
}));

vi.mock("@/lib/apiClient", () => ({
  BASE_URL: "http://localhost:3000",
}));

describe("useDownload", () => {
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
});
