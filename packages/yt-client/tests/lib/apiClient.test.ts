import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchMetadata, fetchFormats, fetchBackends } from "@/lib/apiClient";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
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
    expect(url).toContain(encodeURIComponent("https://www.youtube.com/watch?v=abc&t=10"));
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "Video not found" }),
    });

    await expect(fetchMetadata("https://www.youtube.com/watch?v=bad")).rejects.toThrow(
      "Video not found",
    );
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
