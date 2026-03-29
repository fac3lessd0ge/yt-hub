import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMetadata } from "@/hooks/useMetadata";

const mockFetchMetadata = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  fetchMetadata: (...args: any[]) => mockFetchMetadata(...args),
}));

describe("useMetadata", () => {
  beforeEach(() => {
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

    // fetchMetadata should not be called before the debounce delay
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

    // Advance past the debounce delay
    await vi.advanceTimersByTimeAsync(500);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockFetchMetadata).toHaveBeenCalledWith(
      "https://www.youtube.com/watch?v=abc",
    );
    expect(result.current.metadata).toEqual({
      title: "Test Video",
      author_name: "Test Author",
    });
  });

  it("sets error when fetch fails", async () => {
    mockFetchMetadata.mockRejectedValue(new Error("Not found"));

    const { result } = renderHook(() =>
      useMetadata("https://www.youtube.com/watch?v=bad"),
    );

    await vi.advanceTimersByTimeAsync(500);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("Not found");
    expect(result.current.metadata).toBeNull();
  });

  it("resets metadata when link changes", async () => {
    mockFetchMetadata.mockResolvedValue({
      title: "First Video",
      author_name: "Author",
    });

    const { result, rerender } = renderHook(({ link }) => useMetadata(link), {
      initialProps: { link: "https://www.youtube.com/watch?v=abc" },
    });

    await vi.advanceTimersByTimeAsync(500);

    await waitFor(() => {
      expect(result.current.metadata).not.toBeNull();
    });

    // Change the link - metadata should reset
    rerender({ link: "https://www.youtube.com/watch?v=def" });

    expect(result.current.metadata).toBeNull();
  });
});
