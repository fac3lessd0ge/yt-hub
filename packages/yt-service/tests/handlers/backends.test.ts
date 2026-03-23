import { describe, expect, it } from "vitest";
import type { DownloadService } from "yt-downloader";
import { BackendsHandler } from "~/handlers";

function fakeDownloadService(): DownloadService {
  return {
    listBackends: () => ["yt-dlp"],
  } as unknown as DownloadService;
}

describe("BackendsHandler", () => {
  it("returns backends list", async () => {
    const handler = new BackendsHandler(fakeDownloadService());
    const result = await handler.handle();
    expect(result).toEqual({ backends: ["yt-dlp"] });
  });
});
