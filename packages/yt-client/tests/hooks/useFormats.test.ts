import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFormats } from "@/hooks/useFormats";

const mockListFormats = vi.fn();

describe("useFormats", () => {
  beforeEach(() => {
    mockListFormats.mockReset();
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      listFormats: mockListFormats,
    };
  });

  afterEach(() => {
    (window as unknown as { electronAPI?: unknown }).electronAPI = undefined;
  });

  it("starts in loading state", () => {
    mockListFormats.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useFormats());

    expect(result.current.loading).toBe(true);
    expect(result.current.formats).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("transitions to success with formats data", async () => {
    const formats = [
      { id: "mp3", label: "MP3 audio" },
      { id: "mp4", label: "MP4 video" },
    ];
    mockListFormats.mockResolvedValue({ formats });

    const { result } = renderHook(() => useFormats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.formats).toEqual(formats);
    expect(result.current.error).toBeNull();
  });

  it("transitions to error on fetch failure", async () => {
    mockListFormats.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useFormats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.formats).toEqual([]);
    expect(result.current.error).toBe("Network error");
  });

  it("refetch reloads formats after error", async () => {
    mockListFormats.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useFormats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBe("Network error");

    const formats = [{ id: "mp3", label: "MP3 audio" }];
    mockListFormats.mockResolvedValueOnce({ formats });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.formats).toEqual(formats);
    expect(result.current.error).toBeNull();
  });
});
