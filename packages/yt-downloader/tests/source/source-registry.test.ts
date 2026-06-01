import { describe, expect, it } from "vitest";
import {
  capabilities,
  detectSource,
  getProvider,
  isSupportedUrl,
} from "~/source";

describe("detectSource — YouTube (regression: must match old allow-list)", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "track"],
    ["https://youtube.com/watch?v=abc123", "track"],
    ["https://m.youtube.com/watch?v=abc123", "track"],
    ["https://www.youtube.com/shorts/abc123", "track"],
    ["https://youtu.be/dQw4w9WgXcQ", "track"],
    ["https://www.youtube.com/playlist?list=PL123", "playlist"],
  ])("accepts %s as %s", (url, kind) => {
    expect(detectSource(url)).toEqual({ source: "youtube", kind });
  });

  it.each([
    "https://www.youtube.com/watch", // no v=
    "https://youtu.be/", // no id
    "https://www.youtube.com/", // bare host
  ])("rejects %s", (url) => {
    expect(detectSource(url)).toBeNull();
  });
});

describe("detectSource — SoundCloud", () => {
  it("detects a track", () => {
    expect(detectSource("https://soundcloud.com/artist/some-track")).toEqual({
      source: "soundcloud",
      kind: "track",
    });
  });
  it("detects a set as playlist", () => {
    expect(detectSource("https://soundcloud.com/artist/sets/my-set")).toEqual({
      source: "soundcloud",
      kind: "playlist",
    });
  });
  it("rejects a bare profile", () => {
    expect(detectSource("https://soundcloud.com/artist")).toBeNull();
  });
});

describe("detectSource — Bandcamp", () => {
  it("detects a track on an artist subdomain", () => {
    expect(detectSource("https://c418.bandcamp.com/track/excuse")).toEqual({
      source: "bandcamp",
      kind: "track",
    });
  });
  it("detects an album as playlist", () => {
    expect(
      detectSource("https://infectedmushroom.bandcamp.com/album/return-to-dna"),
    ).toEqual({ source: "bandcamp", kind: "playlist" });
  });
  it("rejects a bare artist page", () => {
    expect(detectSource("https://c418.bandcamp.com/")).toBeNull();
  });
});

describe("detectSource — rejection of junk", () => {
  it.each([
    "",
    "not a url",
    "ftp://youtube.com/watch?v=abc",
    "https://example.com/video",
    "https://vimeo.com/12345",
    "https://dailymotion.com/video/x12345",
    `https://youtube.com/watch?v=${"a".repeat(3000)}`,
  ])("rejects %s", (url) => {
    expect(detectSource(url)).toBeNull();
    expect(isSupportedUrl(url)).toBe(false);
  });
});

describe("capabilities", () => {
  it("marks SoundCloud and Bandcamp as audio-only", () => {
    expect(capabilities("soundcloud").audioOnly).toBe(true);
    expect(capabilities("bandcamp").audioOnly).toBe(true);
  });
  it("marks YouTube as not audio-only", () => {
    expect(capabilities("youtube").audioOnly).toBe(false);
  });
  it("offers only mp3 for audio-only sources", () => {
    expect(capabilities("soundcloud").formats.map((f) => f.id)).toEqual([
      "mp3",
    ]);
  });
  it("offers mp4 + mp3 for video sources", () => {
    expect(capabilities("youtube").formats.map((f) => f.id)).toEqual([
      "mp4",
      "mp3",
    ]);
  });
  it("throws on an unknown source", () => {
    // @ts-expect-error — exercising the runtime guard
    expect(() => getProvider("myspace")).toThrow(/Unknown media source/);
  });
});
