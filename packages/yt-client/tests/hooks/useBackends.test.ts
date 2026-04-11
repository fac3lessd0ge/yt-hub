import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBackends } from "@/hooks/useBackends";

const mockFetchBackends = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  fetchBackends: (...args: any[]) => mockFetchBackends(...args),
}));

describe("useBackends", () => {
  beforeEach(() => {
    mockFetchBackends.mockReset();
  });
  it("starts in loading state", () => {
    mockFetchBackends.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useBackends());

    expect(result.current.loading).toBe(true);
    expect(result.current.backends).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("transitions to success with backends data", async () => {
    mockFetchBackends.mockResolvedValue({ backends: ["yt-dlp", "ytdl-core"] });

    const { result } = renderHook(() => useBackends());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.backends).toEqual(["yt-dlp", "ytdl-core"]);
    expect(result.current.error).toBeNull();
  });

  it("transitions to error on fetch failure", async () => {
    mockFetchBackends.mockRejectedValue(new Error("Server down"));

    const { result } = renderHook(() => useBackends());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.backends).toEqual([]);
    expect(result.current.error).toBe("Server down");
  });

  it("refetch reloads backends after error", async () => {
    mockFetchBackends.mockRejectedValueOnce(new Error("Server down"));

    const { result } = renderHook(() => useBackends());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBe("Server down");

    // Now mock success and call refetch
    mockFetchBackends.mockResolvedValueOnce({ backends: ["yt-dlp"] });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.backends).toEqual(["yt-dlp"]);
    expect(result.current.error).toBeNull();
  });
});
