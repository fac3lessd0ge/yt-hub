import { describe, expect, it } from "vitest";
import { getUrlValidationError, isValidYoutubeUrl } from "@/lib/urlValidation";

describe("isValidYoutubeUrl", () => {
  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=abc123",
    "https://www.youtube.com/watch?v=abc&t=10",
    "https://youtu.be/dQw4w9WgXcQ",
    "http://youtu.be/abc123",
    "https://www.youtube.com/shorts/abc123",
    "https://youtube.com/shorts/def-456",
    "https://m.youtube.com/watch?v=xyz",
    "https://m.youtube.com/shorts/abc123",
  ])("accepts valid URL: %s", (url) => {
    expect(isValidYoutubeUrl(url)).toBe(true);
  });

  it.each([
    "https://vimeo.com/123",
    "https://example.com",
    "not-a-url",
    "ftp://youtube.com/watch?v=abc",
    "https://youtube.com/",
    "https://youtube.com/watch",
    "https://youtube.com/watch?list=abc",
    "https://youtube.com/playlist?list=abc",
    "https://youtu.be/",
    "https://youtube.com/shorts/",
    "",
  ])("rejects invalid URL: %s", (url) => {
    expect(isValidYoutubeUrl(url)).toBe(false);
  });

  it("rejects URLs longer than the 2048 char cap", () => {
    const long = `https://youtube.com/watch?v=${"a".repeat(2048)}`;
    expect(isValidYoutubeUrl(long)).toBe(false);
  });
});

describe("getUrlValidationError", () => {
  it("returns null for empty string", () => {
    expect(getUrlValidationError("")).toBeNull();
  });

  it("returns null for valid YouTube URL", () => {
    expect(
      getUrlValidationError("https://www.youtube.com/watch?v=abc"),
    ).toBeNull();
  });

  it("returns error for non-http URL", () => {
    expect(getUrlValidationError("ftp://youtube.com")).toBe(
      "URL must start with http:// or https://",
    );
  });

  it("returns error for non-YouTube URL", () => {
    expect(getUrlValidationError("https://vimeo.com/123")).toBe(
      "Not a recognized YouTube URL",
    );
  });

  it("returns error for plain text", () => {
    expect(getUrlValidationError("hello world")).toBe(
      "URL must start with http:// or https://",
    );
  });
});
