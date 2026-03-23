import { describe, it, expect } from "vitest";
import { ErrorMapper } from "~/mapping";
import { DownloadError, ValidationError } from "yt-downloader";

class MetadataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetadataError";
  }
}

class DependencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DependencyError";
  }
}

describe("ErrorMapper", () => {
  const mapper = new ErrorMapper();

  it("maps ValidationError to VALIDATION code", () => {
    const result = mapper.mapError(new ValidationError("bad input"));
    expect(result.code).toBe("VALIDATION");
    expect(result.message).toBe("bad input");
  });

  it("maps DownloadError to DOWNLOAD code", () => {
    const result = mapper.mapError(new DownloadError(1));
    expect(result.code).toBe("DOWNLOAD");
  });

  it("maps MetadataError to METADATA code", () => {
    const result = mapper.mapError(new MetadataError("not found"));
    expect(result.code).toBe("METADATA");
    expect(result.message).toBe("not found");
  });

  it("maps DependencyError to DEPENDENCY code", () => {
    const result = mapper.mapError(new DependencyError("missing ffmpeg"));
    expect(result.code).toBe("DEPENDENCY");
    expect(result.message).toBe("missing ffmpeg");
  });

  it("maps unknown Error to INTERNAL code", () => {
    const result = mapper.mapError(new Error("something broke"));
    expect(result.code).toBe("INTERNAL");
    expect(result.message).toBe("something broke");
  });

  it("maps non-Error to INTERNAL code with string message", () => {
    const result = mapper.mapError("string error");
    expect(result.code).toBe("INTERNAL");
    expect(result.message).toBe("string error");
  });
});
