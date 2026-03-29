import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useBackends } from "@/hooks/useBackends";

const mockFetchBackends = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  fetchBackends: (...args: any[]) => mockFetchBackends(...args),
}));

describe("useBackends", () => {
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
});
