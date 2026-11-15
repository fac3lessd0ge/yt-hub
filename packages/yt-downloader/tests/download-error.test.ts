import { describe, expect, it } from "vitest";
import { DownloadError } from "~/download/errors/DownloadError";

describe("DownloadError", () => {
  it("shows the actual failure after long version/runtime warnings", () => {
    const stderr = `${"WARNING: missing runtime\n".repeat(40)}ERROR: unable to download video data: HTTP Error 403: Forbidden`;
    const error = new DownloadError(1, stderr);
    expect(error.message).toContain("HTTP Error 403: Forbidden");
    expect(error.message).not.toContain("WARNING:");
    expect(error.stderr).toBe(stderr);
  });

  it("keeps the tail when no ERROR prefix exists and limits display size", () => {
    const error = new DownloadError(1, `${"x".repeat(3000)}\nConnection reset`);
    expect(error.message).toContain("Connection reset");
    expect(error.message.length).toBeLessThan(2100);
    expect(new DownloadError(1).message).toBe("yt-dlp exited with code 1");
  });
});
