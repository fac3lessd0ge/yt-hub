import { describe, expect, it } from "vitest";
import {
  getMediaSource,
  getUrlValidationError,
  isSupportedMediaUrl,
} from "@/lib/urlValidation";

describe("isSupportedMediaUrl", () => {
  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/shorts/abc123",
    "https://m.youtube.com/watch?v=xyz",
    "https://soundcloud.com/artist/some-track",
    "https://c418.bandcamp.com/track/excuse",
    "https://vk.com/video-22822305_456241864",
    "https://vkvideo.ru/video-22822305_456241864",
  ])("accepts supported track URL: %s", (url) => {
    expect(isSupportedMediaUrl(url)).toBe(true);
  });

  it.each([
    "https://vimeo.com/123",
    "https://example.com",
    "not-a-url",
    "ftp://youtube.com/watch?v=abc",
    "https://youtube.com/",
    "https://youtube.com/watch",
    "https://youtu.be/",
    "https://soundcloud.com/artist", // bare profile
    "",
    // playlists/collections are not single downloadable tracks (yet)
    "https://youtube.com/playlist?list=abc",
    "https://soundcloud.com/artist/sets/my-set",
    "https://c418.bandcamp.com/album/minecraft",
  ])("rejects non-track URL: %s", (url) => {
    expect(isSupportedMediaUrl(url)).toBe(false);
  });

  it("rejects URLs longer than the 2048 char cap", () => {
    const long = `https://youtube.com/watch?v=${"a".repeat(2048)}`;
    expect(isSupportedMediaUrl(long)).toBe(false);
  });
});

describe("getMediaSource", () => {
  it.each([
    ["https://www.youtube.com/watch?v=abc", "youtube"],
    ["https://soundcloud.com/artist/track", "soundcloud"],
    ["https://c418.bandcamp.com/track/excuse", "bandcamp"],
    ["https://vk.com/video-1_2", "vk"],
  ])("maps %s -> %s", (url, source) => {
    expect(getMediaSource(url)).toBe(source);
  });

  it("returns null for unsupported", () => {
    expect(getMediaSource("https://vimeo.com/1")).toBeNull();
  });
});

describe("getUrlValidationError", () => {
  it("returns null for empty string", () => {
    expect(getUrlValidationError("")).toBeNull();
  });

  it("returns null for a valid track from any source", () => {
    expect(
      getUrlValidationError("https://www.youtube.com/watch?v=abc"),
    ).toBeNull();
    expect(getUrlValidationError("https://soundcloud.com/a/b")).toBeNull();
  });

  it("returns error for non-http URL", () => {
    expect(getUrlValidationError("ftp://youtube.com")).toBe(
      "URL must start with http:// or https://",
    );
  });

  it("returns error for an unsupported host", () => {
    expect(getUrlValidationError("https://vimeo.com/123")).toBe(
      "Not a supported URL (YouTube, SoundCloud, VK, Bandcamp)",
    );
  });

  it("returns a playlist-specific error for collection URLs", () => {
    expect(getUrlValidationError("https://soundcloud.com/a/sets/x")).toBe(
      "Playlists aren't supported yet — paste a single track or video URL",
    );
  });

  it("returns error for plain text", () => {
    expect(getUrlValidationError("hello world")).toBe(
      "URL must start with http:// or https://",
    );
  });
});
