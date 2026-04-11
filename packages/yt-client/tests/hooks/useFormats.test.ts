import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFormats } from "@/hooks/useFormats";

const mockFetchFormats = vi.fn();

vi.mock("@/lib/apiClient", () => ({
  fetchFormats: (...args: any[]) => mockFetchFormats(...args),
}));

describe("useFormats", () => {
  beforeEach(() => {
    mockFetchFormats.mockReset();
  });
  it("starts in loading state", () => {
    mockFetchFormats.mockReturnValue(new Promise(() => {})); // never resolves
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
    mockFetchFormats.mockResolvedValue({ formats });

    const { result } = renderHook(() => useFormats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.formats).toEqual(formats);
    expect(result.current.error).toBeNull();
  });

  it("transitions to error on fetch failure", async () => {
    mockFetchFormats.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useFormats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.formats).toEqual([]);
    expect(result.current.error).toBe("Network error");
  });
});
