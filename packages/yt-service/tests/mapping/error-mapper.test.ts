import { describe, expect, it } from "vitest";
import {
  CancellationError,
  DependencyError,
  DownloadError,
  MetadataError,
  TimeoutError,
  ValidationError,
} from "yt-downloader";
import { ErrorMapper } from "~/mapping";

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

  it("maps CancellationError to CANCELLED code", () => {
    const result = mapper.mapError(new CancellationError());
    expect(result.code).toBe("CANCELLED");
  });

  it("maps MetadataError to METADATA_FAILED code", () => {
    const result = mapper.mapError(new MetadataError("not found"));
    expect(result.code).toBe("METADATA_FAILED");
    expect(result.message).toBe("not found");
  });

  it("maps MetadataError with 404 to VIDEO_NOT_FOUND code", () => {
    const result = mapper.mapError(new MetadataError("not found", 404));
    expect(result.code).toBe("VIDEO_NOT_FOUND");
  });

  it("maps DependencyError to DEPENDENCY_MISSING code", () => {
    const result = mapper.mapError(
      new DependencyError("ffmpeg", "brew install ffmpeg"),
    );
    expect(result.code).toBe("DEPENDENCY_MISSING");
  });

  it("maps TimeoutError to REQUEST_TIMEOUT code", () => {
    const result = mapper.mapError(new TimeoutError(30000));
    expect(result.code).toBe("REQUEST_TIMEOUT");
    expect(result.retryable).toBe(true);
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
