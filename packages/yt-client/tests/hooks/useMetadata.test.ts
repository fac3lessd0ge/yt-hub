import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMetadata } from "@/hooks/useMetadata";

const mockFetchMetadata = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  fetchMetadata: (...args: any[]) => mockFetchMetadata(...args),
}));

describe("useMetadata", () => {
  beforeEach(() => {
    mockFetchMetadata.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null metadata and no loading when link is empty", () => {
    const { result } = renderHook(() => useMetadata(""));

    expect(result.current.metadata).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("does not fetch immediately due to debounce", () => {
    renderHook(() => useMetadata("https://www.youtube.com/watch?v=abc"));

    expect(mockFetchMetadata).not.toHaveBeenCalled();
  });

  it("fetches metadata after debounce delay (500ms)", async () => {
    mockFetchMetadata.mockResolvedValue({
      title: "Test Video",
      author_name: "Test Author",
    });

    const { result } = renderHook(() =>
      useMetadata("https://www.youtube.com/watch?v=abc"),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(mockFetchMetadata).toHaveBeenCalledWith(
      "https://www.youtube.com/watch?v=abc",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.current.metadata).toEqual({
      title: "Test Video",
      author_name: "Test Author",
    });
    expect(result.current.loading).toBe(false);
  });

  it("sets error when fetch fails", async () => {
    mockFetchMetadata.mockRejectedValue(new Error("Not found"));

    const { result } = renderHook(() =>
      useMetadata("https://www.youtube.com/watch?v=bad"),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(result.current.error).toBe("Not found");
    expect(result.current.metadata).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("resets metadata when link changes", async () => {
    mockFetchMetadata.mockResolvedValue({
      title: "First Video",
      author_name: "Author",
    });

    const { result, rerender } = renderHook(({ link }) => useMetadata(link), {
      initialProps: { link: "https://www.youtube.com/watch?v=abc" },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(result.current.metadata).not.toBeNull();

    rerender({ link: "https://www.youtube.com/watch?v=def" });

    expect(result.current.metadata).toBeNull();
  });

  it("aborts in-flight request when link changes rapidly", async () => {
    const resolvers: Array<{
      resolve: (v: any) => void;
      signal: AbortSignal;
    }> = [];

    mockFetchMetadata.mockImplementation(
      (_link: string, opts?: { signal?: AbortSignal }) => {
        return new Promise((resolve, reject) => {
          const signal = opts?.signal as AbortSignal;
          resolvers.push({ resolve, signal });
          signal?.addEventListener("abort", () => {
            reject(
              new DOMException("The operation was aborted.", "AbortError"),
            );
          });
        });
      },
    );

    const { result, rerender } = renderHook(({ link }) => useMetadata(link), {
      initialProps: { link: "https://www.youtube.com/watch?v=first" },
    });

    // Let first debounce fire
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(mockFetchMetadata).toHaveBeenCalledTimes(1);
    expect(resolvers[0].signal.aborted).toBe(false);

    // Change link — should abort first request
    rerender({ link: "https://www.youtube.com/watch?v=second" });

    expect(resolvers[0].signal.aborted).toBe(true);

    // Let second debounce fire
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(mockFetchMetadata).toHaveBeenCalledTimes(2);

    // Resolve second request
    await act(async () => {
      resolvers[1].resolve({
        title: "Second Video",
        author_name: "Author",
      });
    });

    expect(result.current.metadata).toEqual({
      title: "Second Video",
      author_name: "Author",
    });
    expect(result.current.error).toBeNull();
  });

  it("does not update state after abort (stale response guard)", async () => {
    let capturedResolve: ((v: any) => void) | null = null;
    let capturedSignal: AbortSignal | null = null;

    mockFetchMetadata.mockImplementation(
      (_link: string, opts?: { signal?: AbortSignal }) => {
        return new Promise((resolve) => {
          capturedResolve = resolve;
          capturedSignal = opts?.signal ?? null;
        });
      },
    );

    const { result, unmount } = renderHook(() =>
      useMetadata("https://www.youtube.com/watch?v=test"),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(capturedSignal).not.toBeNull();
    expect(capturedSignal?.aborted).toBe(false);

    // Unmount aborts the controller
    unmount();

    expect(capturedSignal?.aborted).toBe(true);

    // Resolve after unmount — should not throw or update state
    await act(async () => {
      capturedResolve?.({ title: "Stale", author_name: "Ghost" });
    });

    // metadata should still be null (was reset, never set to stale data)
    expect(result.current.metadata).toBeNull();
  });
});
