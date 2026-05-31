import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMetadata } from "@/hooks/useMetadata";

const mockGetMetadata = vi.fn();

describe("useMetadata", () => {
  beforeEach(() => {
    mockGetMetadata.mockReset();
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      getMetadata: mockGetMetadata,
    };
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    (window as unknown as { electronAPI?: unknown }).electronAPI = undefined;
  });

  it("returns null metadata and no loading when link is empty", () => {
    const { result } = renderHook(() => useMetadata(""));

    expect(result.current.metadata).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("does not fetch immediately due to debounce", () => {
    renderHook(() => useMetadata("https://www.youtube.com/watch?v=abc"));

    expect(mockGetMetadata).not.toHaveBeenCalled();
  });

  it("fetches metadata after debounce delay (500ms)", async () => {
    mockGetMetadata.mockResolvedValue({
      title: "Test Video",
      author_name: "Test Author",
    });

    const { result } = renderHook(() =>
      useMetadata("https://www.youtube.com/watch?v=abc"),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(mockGetMetadata).toHaveBeenCalledWith(
      "https://www.youtube.com/watch?v=abc",
    );
    expect(result.current.metadata).toEqual({
      title: "Test Video",
      author_name: "Test Author",
    });
    expect(result.current.loading).toBe(false);
  });

  it("sets error when fetch fails", async () => {
    mockGetMetadata.mockRejectedValue(new Error("Not found"));

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
    mockGetMetadata.mockResolvedValue({
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

  it("drops a stale in-flight response when the link changes rapidly", async () => {
    const resolvers: Array<(v: unknown) => void> = [];
    mockGetMetadata.mockImplementation(
      () => new Promise((resolve) => resolvers.push(resolve)),
    );

    const { result, rerender } = renderHook(({ link }) => useMetadata(link), {
      initialProps: { link: "https://www.youtube.com/watch?v=first" },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(mockGetMetadata).toHaveBeenCalledTimes(1);

    // Change link before the first request resolves.
    rerender({ link: "https://www.youtube.com/watch?v=second" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(mockGetMetadata).toHaveBeenCalledTimes(2);

    // Resolve the FIRST (stale) request — must be ignored.
    await act(async () => {
      resolvers[0]({ title: "Stale", author_name: "Ghost" });
    });
    expect(result.current.metadata).toBeNull();

    // Resolve the SECOND (current) request.
    await act(async () => {
      resolvers[1]({ title: "Second Video", author_name: "Author" });
    });
    expect(result.current.metadata).toEqual({
      title: "Second Video",
      author_name: "Author",
    });
    expect(result.current.error).toBeNull();
  });

  it("does not update state after unmount (stale response guard)", async () => {
    let capturedResolve: ((v: unknown) => void) | null = null;
    mockGetMetadata.mockImplementation(
      () =>
        new Promise((resolve) => {
          capturedResolve = resolve;
        }),
    );

    const { result, unmount } = renderHook(() =>
      useMetadata("https://www.youtube.com/watch?v=test"),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    unmount();

    await act(async () => {
      capturedResolve?.({ title: "Stale", author_name: "Ghost" });
    });

    expect(result.current.metadata).toBeNull();
  });
});
