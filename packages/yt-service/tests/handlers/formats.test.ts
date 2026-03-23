import { describe, it, expect } from "vitest";
import { FormatsHandler } from "~/handlers";
import { ResponseMapper } from "~/mapping";
import type { DownloadService } from "yt-downloader";

function fakeDownloadService(): DownloadService {
  return {
    listFormats: () => [
      { id: "mp3", label: "MP3 audio" },
      { id: "mp4", label: "MP4 video" },
    ],
  } as unknown as DownloadService;
}

describe("FormatsHandler", () => {
  it("returns mapped formats list", async () => {
    const handler = new FormatsHandler(
      fakeDownloadService(),
      new ResponseMapper()
    );
    const result = await handler.handle();
    expect(result).toEqual({
      formats: [
        { id: "mp3", label: "MP3 audio" },
        { id: "mp4", label: "MP4 video" },
      ],
    });
  });
});
