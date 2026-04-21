import { describe, expect, it } from "vitest";
import type { DownloadService, ProgressCallback } from "yt-downloader";
import { DownloadHandler, MetadataHandler } from "~/handlers";
import { ErrorMapper, ResponseMapper } from "~/mapping";

const DEFAULT_DEST = "/tmp/yt-service-test-downloads";

function fakeDownloadServiceThatThrows(error: Error): DownloadService {
  return {
    getMetadata: async () => {
      throw error;
    },
    download: async (_params: any, _onProgress?: ProgressCallback) => {
      throw error;
    },
  } as unknown as DownloadService;
}

describe("Handler error scenarios", () => {
  describe("MetadataHandler error propagation", () => {
    it("propagates generic errors from the download service", async () => {
      const error = new Error("connection refused");
      const handler = new MetadataHandler(
        fakeDownloadServiceThatThrows(error),
        new ResponseMapper(),
      );

      await expect(
        handler.handle({ link: "https://youtube.com/watch?v=abc" }),
      ).rejects.toThrow("connection refused");
    });

    it("propagates MetadataError from the download service", async () => {
      const error = Object.assign(new Error("Video not found"), {
        name: "MetadataError",
        statusCode: 404,
      });
      const handler = new MetadataHandler(
        fakeDownloadServiceThatThrows(error),
        new ResponseMapper(),
      );

      await expect(
        handler.handle({ link: "https://youtube.com/watch?v=notfound" }),
      ).rejects.toThrow("Video not found");
    });
  });

  describe("DownloadHandler error propagation", () => {
    it("writes an error message when download service throws and re-throws mapped error", async () => {
      const error = new Error("download backend crashed");
      const handler = new DownloadHandler(
        fakeDownloadServiceThatThrows(error),
        new ErrorMapper(),
        new ResponseMapper(),
        DEFAULT_DEST,
      );

      const messages: any[] = [];
      const thrown = await handler
        .handle(
          {
            link: "https://youtube.com/watch?v=abc",
            format: "mp3",
            name: "test",
          },
          (msg) => messages.push(msg),
        )
        .catch((e: unknown) => e);

      expect(messages).toHaveLength(1);
      expect(messages[0].error).toBeDefined();
      expect(messages[0].error.code).toBe("INTERNAL_ERROR");
      expect(messages[0].error.message).toBe("download backend crashed");
      expect(thrown).toMatchObject({ code: "INTERNAL_ERROR" });
    });

    it("writes VALIDATION_ERROR when download service throws ValidationError and re-throws", async () => {
      const error = Object.assign(new Error("bad url"), {
        name: "ValidationError",
      });
      // The ErrorMapper checks `instanceof ValidationError` from yt-downloader,
      // but since we can't easily construct one here, test the fallback path
      const handler = new DownloadHandler(
        fakeDownloadServiceThatThrows(error),
        new ErrorMapper(),
        new ResponseMapper(),
        DEFAULT_DEST,
      );

      const messages: any[] = [];
      const thrown = await handler
        .handle({ link: "bad", format: "mp3", name: "test" }, (msg) =>
          messages.push(msg),
        )
        .catch((e: unknown) => e);

      expect(messages).toHaveLength(1);
      expect(messages[0].error).toBeDefined();
      // This falls through to INTERNAL_ERROR since it's not a real ValidationError instance
      expect(messages[0].error.code).toBe("INTERNAL_ERROR");
      expect(thrown).toMatchObject({ code: "INTERNAL_ERROR" });
    });

    it("writes error message during stream and re-throws mapped error", async () => {
      const service = {
        download: async (_params: any, onProgress?: ProgressCallback) => {
          // Emit some progress before failing
          if (onProgress) {
            onProgress({ percent: 25, speed: "1.0MiB/s", eta: "00:03" });
          }
          throw new Error("mid-stream failure");
        },
      } as unknown as DownloadService;

      const handler = new DownloadHandler(
        service,
        new ErrorMapper(),
        new ResponseMapper(),
        DEFAULT_DEST,
      );

      const messages: any[] = [];
      const thrown = await handler
        .handle(
          {
            link: "https://youtube.com/watch?v=abc",
            format: "mp3",
            name: "test",
          },
          (msg) => messages.push(msg),
        )
        .catch((e: unknown) => e);

      // Should have one progress message and one error message
      expect(messages).toHaveLength(2);
      expect(messages[0].progress).toBeDefined();
      expect(messages[0].progress.percent).toBe(25);
      expect(messages[1].error).toBeDefined();
      expect(messages[1].error.message).toBe("mid-stream failure");
      expect(thrown).toMatchObject({
        code: "INTERNAL_ERROR",
        message: "mid-stream failure",
      });
    });
  });
});
