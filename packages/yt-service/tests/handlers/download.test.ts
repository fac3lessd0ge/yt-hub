import { describe, it, expect } from "vitest";
import { DownloadHandler } from "~/handlers";
import { ErrorMapper, ResponseMapper } from "~/mapping";
import { ValidationError } from "yt-downloader";
import type { DownloadService, ProgressCallback } from "yt-downloader";

function fakeDownloadService(options?: {
  progressUpdates?: { percent: number; speed: string; eta: string }[];
  throwError?: Error;
}): DownloadService {
  return {
    download: async (params: any, onProgress?: ProgressCallback) => {
      if (options?.throwError) throw options.throwError;

      if (options?.progressUpdates && onProgress) {
        for (const update of options.progressUpdates) {
          onProgress(update);
        }
      }

      return {
        outputPath: "/tmp/test.mp3",
        metadata: { title: "Test Video", authorName: "Test Author" },
        format: { id: "mp3", label: "MP3 audio" },
      };
    },
  } as unknown as DownloadService;
}

describe("DownloadHandler", () => {
  it("streams progress updates and completion", async () => {
    const progressUpdates = [
      { percent: 25, speed: "2.00MiB/s", eta: "00:03" },
      { percent: 75, speed: "3.00MiB/s", eta: "00:01" },
    ];
    const handler = new DownloadHandler(
      fakeDownloadService({ progressUpdates }),
      new ErrorMapper(),
      new ResponseMapper()
    );

    const messages: any[] = [];
    await handler.handle(
      { link: "https://youtube.com/watch?v=abc", format: "mp3", name: "test" },
      (msg) => messages.push(msg)
    );

    expect(messages).toHaveLength(3);
    expect(messages[0]).toEqual({
      progress: { percent: 25, speed: "2.00MiB/s", eta: "00:03" },
    });
    expect(messages[1]).toEqual({
      progress: { percent: 75, speed: "3.00MiB/s", eta: "00:01" },
    });
    expect(messages[2]).toEqual({
      complete: {
        output_path: "/tmp/test.mp3",
        title: "Test Video",
        author_name: "Test Author",
        format_id: "mp3",
        format_label: "MP3 audio",
      },
    });
  });

  it("sends error message on failure", async () => {
    const handler = new DownloadHandler(
      fakeDownloadService({ throwError: new ValidationError("bad link") }),
      new ErrorMapper(),
      new ResponseMapper()
    );

    const messages: any[] = [];
    await handler.handle(
      { link: "bad", format: "mp3", name: "test" },
      (msg) => messages.push(msg)
    );

    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({
      error: { code: "VALIDATION", message: "bad link" },
    });
  });

  it("sends completion without progress when no callback invocations", async () => {
    const handler = new DownloadHandler(
      fakeDownloadService(),
      new ErrorMapper(),
      new ResponseMapper()
    );

    const messages: any[] = [];
    await handler.handle(
      { link: "https://youtube.com/watch?v=abc", format: "mp3", name: "test" },
      (msg) => messages.push(msg)
    );

    expect(messages).toHaveLength(1);
    expect(messages[0].complete).toBeDefined();
  });
});
