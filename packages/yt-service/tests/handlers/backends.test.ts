import { describe, it, expect } from "vitest";
import { BackendsHandler } from "~/handlers";
import type { DownloadService } from "yt-downloader";

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
