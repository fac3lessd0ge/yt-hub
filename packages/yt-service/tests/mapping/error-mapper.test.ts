import { describe, expect, it } from "vitest";
import { DownloadError, ValidationError } from "yt-downloader";
import { ErrorMapper } from "~/mapping";

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
    expect(result.code).toBe("VALIDATION_ERROR");
    expect(result.message).toBe("bad input");
  });

  it("maps DownloadError to DOWNLOAD_FAILED code", () => {
    const result = mapper.mapError(new DownloadError(1));
    expect(result.code).toBe("DOWNLOAD_FAILED");
  });

  it("maps MetadataError to METADATA_FAILED code", () => {
    const result = mapper.mapError(new MetadataError("not found"));
    expect(result.code).toBe("METADATA_FAILED");
    expect(result.message).toBe("not found");
  });

  it("maps DependencyError to DEPENDENCY_MISSING code", () => {
    const result = mapper.mapError(new DependencyError("missing ffmpeg"));
    expect(result.code).toBe("DEPENDENCY_MISSING");
    expect(result.message).toBe("missing ffmpeg");
  });

  it("maps unknown Error to INTERNAL_ERROR code", () => {
    const result = mapper.mapError(new Error("something broke"));
    expect(result.code).toBe("INTERNAL_ERROR");
    expect(result.message).toBe("something broke");
  });

  it("maps non-Error to INTERNAL_ERROR code with string message", () => {
    const result = mapper.mapError("string error");
    expect(result.code).toBe("INTERNAL_ERROR");
    expect(result.message).toBe("string error");
  });
});
