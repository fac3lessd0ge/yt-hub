import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { OutputPathBuilder } from "~/output";

describe("OutputPathBuilder", () => {
  const builder = new OutputPathBuilder();

  it("builds path from name, format, and destination", () => {
    expect(builder.build("song", "mp3", "/tmp/downloads")).toBe(
      "/tmp/downloads/song.mp3",
    );
  });

  it("strips existing extension and uses format", () => {
    expect(builder.build("song.wav", "mp3", "/tmp/downloads")).toBe(
      "/tmp/downloads/song.mp3",
    );
  });

  it("handles mp4 format", () => {
    expect(builder.build("video", "mp4", "/tmp/downloads")).toBe(
      "/tmp/downloads/video.mp4",
    );
  });

  it("uses absolute destination as-is", () => {
    expect(builder.build("test", "mp3", "/absolute/path")).toBe(
      "/absolute/path/test.mp3",
    );
  });

  it("resolves relative destination against cwd", () => {
    expect(builder.build("test", "mp3", "./relative")).toBe(
      resolve("./relative", "test.mp3"),
    );
  });

  it("handles name with matching format extension", () => {
    expect(builder.build("song.mp3", "mp3", "/tmp")).toBe("/tmp/song.mp3");
  });

  it("handles name with dots in it", () => {
    expect(builder.build("my.cool.song", "mp3", "/tmp")).toBe(
      "/tmp/my.cool.mp3",
    );
  });

  it("returns original path when no exists function provided", () => {
    expect(builder.build("song", "mp3", "/tmp")).toBe("/tmp/song.mp3");
  });

  it("returns original path when file does not exist", () => {
    const exists = () => false;
    expect(builder.build("song", "mp3", "/tmp", exists)).toBe(
      "/tmp/song.mp3",
    );
  });

  it("appends _1 suffix when file exists", () => {
    const exists = (p: string) => p === "/tmp/song.mp3";
    expect(builder.build("song", "mp3", "/tmp", exists)).toBe(
      "/tmp/song_1.mp3",
    );
  });

  it("appends _2 when _1 also exists", () => {
    const existing = new Set(["/tmp/song.mp3", "/tmp/song_1.mp3"]);
    const exists = (p: string) => existing.has(p);
    expect(builder.build("song", "mp3", "/tmp", exists)).toBe(
      "/tmp/song_2.mp3",
    );
  });
});
