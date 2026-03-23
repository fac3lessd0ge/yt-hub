import { describe, it, expect } from "vitest";
import { MetadataHandler } from "~/handlers";
import { ResponseMapper } from "~/mapping";
import type { DownloadService } from "yt-downloader";

function fakeDownloadService(): DownloadService {
  return {
    getMetadata: async () => ({
      title: "Test Video",
      authorName: "Test Author",
    }),
  } as unknown as DownloadService;
}

describe("MetadataHandler", () => {
  it("returns mapped metadata response", async () => {
    const handler = new MetadataHandler(
      fakeDownloadService(),
      new ResponseMapper()
    );
    const result = await handler.handle({ link: "https://www.youtube.com/watch?v=abc" });
    expect(result).toEqual({
      title: "Test Video",
      author_name: "Test Author",
    });
  });
});
