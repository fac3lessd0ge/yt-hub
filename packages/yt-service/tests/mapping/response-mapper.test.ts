import { describe, it, expect } from "vitest";
import { ResponseMapper } from "~/mapping";
import type {
  VideoMetadata,
  FormatInfo,
  DownloadProgress,
  DownloadResult,
} from "yt-downloader";

describe("ResponseMapper", () => {
  const mapper = new ResponseMapper();

  it("maps VideoMetadata to proto response", () => {
    const metadata: VideoMetadata = {
      title: "Test Video",
      authorName: "Test Author",
    };
    const result = mapper.toMetadataResponse(metadata);
    expect(result).toEqual({
      title: "Test Video",
      author_name: "Test Author",
    });
  });

  it("maps FormatInfo to proto format", () => {
    const format: FormatInfo = { id: "mp3", label: "MP3 audio" };
    const result = mapper.toFormatInfo(format);
    expect(result).toEqual({ id: "mp3", label: "MP3 audio" });
  });

  it("maps DownloadProgress to proto progress", () => {
    const progress: DownloadProgress = {
      percent: 45.2,
      speed: "2.50MiB/s",
      eta: "00:05",
    };
    const result = mapper.toDownloadProgress(progress);
    expect(result).toEqual({
      progress: { percent: 45.2, speed: "2.50MiB/s", eta: "00:05" },
    });
  });

  it("maps DownloadResult to proto complete", () => {
    const downloadResult: DownloadResult = {
      outputPath: "/tmp/test.mp3",
      metadata: { title: "Test", authorName: "Author" },
      format: { id: "mp3", label: "MP3 audio" },
    };
    const result = mapper.toDownloadComplete(downloadResult);
    expect(result).toEqual({
      complete: {
        output_path: "/tmp/test.mp3",
        title: "Test",
        author_name: "Author",
        format_id: "mp3",
        format_label: "MP3 audio",
      },
    });
  });

  it("maps error to proto error", () => {
    const result = mapper.toDownloadError("VALIDATION", "bad input");
    expect(result).toEqual({
      error: { code: "VALIDATION", message: "bad input" },
    });
  });
});
