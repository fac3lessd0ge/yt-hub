import { describe, expect, it } from "vitest";
import { getYoutubeThumbnailUrl } from "@/lib/youtubeThumbnail";

describe("getYoutubeThumbnailUrl", () => {
  it("returns null for an empty string", () => {
    expect(getYoutubeThumbnailUrl("")).toBeNull();
  });

  it("returns null for a non-URL string", () => {
    expect(getYoutubeThumbnailUrl("not a url")).toBeNull();
  });

  it("returns null for a non-YouTube URL", () => {
    expect(getYoutubeThumbnailUrl("https://vimeo.com/123456789")).toBeNull();
  });

  it("returns null for a YouTube URL with no video ID path", () => {
    expect(
      getYoutubeThumbnailUrl("https://www.youtube.com/channel/UCxyz"),
    ).toBeNull();
  });

  it("returns null for a /watch URL missing the v param", () => {
    expect(getYoutubeThumbnailUrl("https://www.youtube.com/watch")).toBeNull();
  });

  it("returns null for a youtu.be URL with no path", () => {
    expect(getYoutubeThumbnailUrl("https://youtu.be/")).toBeNull();
  });

  it("extracts ID from a standard /watch?v= URL", () => {
    expect(
      getYoutubeThumbnailUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });

  it("extracts ID from a youtu.be short URL", () => {
    expect(getYoutubeThumbnailUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    );
  });

  it("extracts ID from a /shorts/ URL", () => {
    expect(
      getYoutubeThumbnailUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
    ).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });

  it("handles www. prefix", () => {
    expect(
      getYoutubeThumbnailUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });

  it("handles m. prefix", () => {
    expect(
      getYoutubeThumbnailUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });

  it("returns null when video ID is not exactly 11 characters", () => {
    // Short IDs should be rejected
    expect(
      getYoutubeThumbnailUrl("https://www.youtube.com/watch?v=short"),
    ).toBeNull();
  });

  it("returns null when /shorts/ segment is empty", () => {
    expect(
      getYoutubeThumbnailUrl("https://www.youtube.com/shorts/"),
    ).toBeNull();
  });
});
