import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBackends } from "@/hooks/useBackends";

const mockListBackends = vi.fn();

describe("useBackends", () => {
  beforeEach(() => {
    mockListBackends.mockReset();
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      listBackends: mockListBackends,
    };
  });

  afterEach(() => {
    (window as unknown as { electronAPI?: unknown }).electronAPI = undefined;
  });

  it("starts in loading state", () => {
    mockListBackends.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useBackends());

    expect(result.current.loading).toBe(true);
    expect(result.current.backends).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("transitions to success with backends data", async () => {
    mockListBackends.mockResolvedValue({ backends: ["yt-dlp", "ytdl-core"] });

    const { result } = renderHook(() => useBackends());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.backends).toEqual(["yt-dlp", "ytdl-core"]);
    expect(result.current.error).toBeNull();
  });

  it("transitions to error on fetch failure", async () => {
    mockListBackends.mockRejectedValue(new Error("Server down"));

    const { result } = renderHook(() => useBackends());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.backends).toEqual([]);
    expect(result.current.error).toBe("Server down");
  });

  it("refetch reloads backends after error", async () => {
    mockListBackends.mockRejectedValueOnce(new Error("Server down"));

    const { result } = renderHook(() => useBackends());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBe("Server down");

    mockListBackends.mockResolvedValueOnce({ backends: ["yt-dlp"] });

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
