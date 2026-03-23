import { describe, it, expect } from "vitest";
import { resolve } from "path";
import { InputValidator, YOUTUBE_PATTERNS, DEFAULT_DESTINATION, ValidationError } from "~/input";
import type { IDownloadBackend } from "~/download";

function fakeBackend(): IDownloadBackend {
  return {
    name: "test",
    supportedFormats: () => [
      { id: "mp3", label: "MP3 audio" },
      { id: "mp4", label: "MP4 video" },
    ],
    requiredDependencies: () => [],
    download: async () => {},
  };
}

function createValidator() {
  return new InputValidator(fakeBackend());
}

describe("InputValidator", () => {
  it("returns ValidatedInput for valid input", () => {
    const validator = createValidator();
    const result = validator.validate({ link: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", name: "test", format: "mp3" });
    expect(result.link).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result.name).toBe("test");
    expect(result.formatId).toBe("mp3");
    expect(result.destination).toBe(DEFAULT_DESTINATION);
  });

  it("accepts youtu.be short links", () => {
    const result = createValidator().validate({ link: "https://youtu.be/dQw4w9WgXcQ", name: "test", format: "mp4" });
    expect(result.formatId).toBe("mp4");
  });

  it("accepts youtube shorts links", () => {
    const result = createValidator().validate({ link: "https://www.youtube.com/shorts/abc123", name: "test", format: "mp3" });
    expect(result.link).toContain("shorts");
  });

  it("throws ValidationError on missing link", () => {
    expect(() => createValidator().validate({ name: "test", format: "mp3" })).toThrow(ValidationError);
  });

  it("throws ValidationError on missing name", () => {
    expect(() => createValidator().validate({ link: "https://www.youtube.com/watch?v=abc", format: "mp3" })).toThrow(ValidationError);
  });

  it("throws ValidationError on missing format", () => {
    expect(() => createValidator().validate({ link: "https://www.youtube.com/watch?v=abc", name: "test" })).toThrow(ValidationError);
  });

  it("throws ValidationError on unsupported format", () => {
    expect(() => createValidator().validate({ link: "https://www.youtube.com/watch?v=abc", name: "test", format: "wav" })).toThrow(ValidationError);
  });

  it("throws ValidationError on non-YouTube URL", () => {
    expect(() => createValidator().validate({ link: "https://vimeo.com/12345", name: "test", format: "mp3" })).toThrow(ValidationError);
  });

  it("normalizes format to lowercase", () => {
    const result = createValidator().validate({ link: "https://www.youtube.com/watch?v=abc", name: "test", format: "MP3" });
    expect(result.formatId).toBe("mp3");
  });

  it("uses provided destination", () => {
    const result = createValidator().validate({ link: "https://www.youtube.com/watch?v=abc", name: "test", format: "mp3", destination: "/tmp/downloads" });
    expect(result.destination).toBe("/tmp/downloads");
  });

  it("resolves relative destination to absolute path", () => {
    const result = createValidator().validate({ link: "https://www.youtube.com/watch?v=abc", name: "test", format: "mp3", destination: "./my-downloads" });
    expect(result.destination).toBe(resolve("./my-downloads"));
  });

  it("uses default destination when not provided", () => {
    const result = createValidator().validate({ link: "https://www.youtube.com/watch?v=abc", name: "test", format: "mp3" });
    expect(result.destination).toBe(DEFAULT_DESTINATION);
  });

  it("validates format against backend's supported formats", () => {
    const limitedBackend: IDownloadBackend = {
      name: "limited",
      supportedFormats: () => [{ id: "mp4", label: "MP4 video" }],
      requiredDependencies: () => [],
      download: async () => {},
    };
    expect(() => new InputValidator(limitedBackend).validate({ link: "https://www.youtube.com/watch?v=abc", name: "test", format: "mp3" })).toThrow(ValidationError);
  });
});

describe("YOUTUBE_PATTERNS", () => {
  it("contains expected patterns", () => {
    expect(YOUTUBE_PATTERNS).toContain("youtube.com/watch");
    expect(YOUTUBE_PATTERNS).toContain("youtu.be/");
    expect(YOUTUBE_PATTERNS).toContain("youtube.com/shorts/");
  });
});
