import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBackends, fetchFormats, fetchMetadata } from "@/lib/apiClient";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.useFakeTimers();
  mockFetch.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("fetchMetadata", () => {
  it("returns metadata for a valid link", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ title: "Test Video", author_name: "Test Author" }),
    });

    const result = await fetchMetadata("https://www.youtube.com/watch?v=abc");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/metadata?link="),
    );
    expect(result.title).toBe("Test Video");
    expect(result.author_name).toBe("Test Author");
  });

  it("encodes the link parameter", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ title: "Test", author_name: "Author" }),
    });

    await fetchMetadata("https://www.youtube.com/watch?v=abc&t=10");

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain(
      encodeURIComponent("https://www.youtube.com/watch?v=abc&t=10"),
    );
  });

  it("throws on HTTP error with JSON body (4xx, no retry)", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ message: "Video not found" }),
    });

    await expect(
      fetchMetadata("https://www.youtube.com/watch?v=bad"),
    ).rejects.toThrow("Video not found");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("throws with text body after exhausting retries on 5xx", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => "Bad Gateway",
    });

    const promise = fetchMetadata("https://www.youtube.com/watch?v=bad").catch(
      (e: Error) => e,
    );
    await vi.advanceTimersByTimeAsync(10000);
    const err = await promise;

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe("Bad Gateway");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("throws with HTTP status when body is unreadable after retries", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => {
        throw new Error("body consumed");
      },
    });

    const promise = fetchMetadata("https://www.youtube.com/watch?v=bad").catch(
      (e: Error) => e,
    );
    await vi.advanceTimersByTimeAsync(10000);
    const err = await promise;

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe("HTTP 500");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("retries on network error and succeeds", async () => {
    mockFetch
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ title: "Test", author_name: "Author" }),
      });

    const promise = fetchMetadata("https://www.youtube.com/watch?v=abc");
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result.title).toBe("Test");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("handles 429 with Retry-After header", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ "Retry-After": "2" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ title: "Test", author_name: "Author" }),
      });

    const promise = fetchMetadata("https://www.youtube.com/watch?v=abc");
    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;

    expect(result.title).toBe("Test");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe("fetchFormats", () => {
  it("returns formats list", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        formats: [
          { id: "mp3", label: "MP3 audio" },
          { id: "mp4", label: "MP4 video" },
        ],
      }),
    });

    const result = await fetchFormats();
    expect(result.formats).toHaveLength(2);
    expect(result.formats[0].id).toBe("mp3");
  });
});

describe("fetchBackends", () => {
  it("returns backends list", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ backends: ["yt-dlp"] }),
    });

    const result = await fetchBackends();
    expect(result.backends).toEqual(["yt-dlp"]);
  });
});
