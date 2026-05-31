import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { BundledBinaryResolver } from "@/main/BundledBinaryResolver";

const USER_BIN = "/home/user/.config/yt-hub/bin";
const RES_BIN = "/opt/yt-hub/resources/bin";

function makeResolver(
  existing: string[],
  whichResult: string | null = null,
): { resolver: BundledBinaryResolver; which: ReturnType<typeof vi.fn> } {
  const existsSet = new Set(existing.map((p) => path.resolve(p)));
  const which = vi.fn().mockReturnValue(whichResult);
  const resolver = new BundledBinaryResolver({
    userBinDir: USER_BIN,
    resourcesBinDir: RES_BIN,
    exists: (p) => existsSet.has(path.resolve(p)),
    which,
  });
  return { resolver, which };
}

describe("BundledBinaryResolver", () => {
  it("prefers the user bin dir over the bundled and PATH locations", () => {
    const userPath = path.join(USER_BIN, "yt-dlp");
    const { resolver, which } = makeResolver(
      [userPath, path.join(RES_BIN, "yt-dlp")],
      "/usr/bin/yt-dlp",
    );

    expect(resolver.resolve("yt-dlp")).toBe(path.resolve(userPath));
    expect(which).not.toHaveBeenCalled();
  });

  it("falls back to the bundled resources bin when the user bin is missing", () => {
    const resPath = path.join(RES_BIN, "ffmpeg");
    const { resolver, which } = makeResolver([resPath], "/usr/bin/ffmpeg");

    expect(resolver.resolve("ffmpeg")).toBe(path.resolve(resPath));
    expect(which).not.toHaveBeenCalled();
  });

  it("falls back to PATH via which when no bundled binary exists", () => {
    const { resolver, which } = makeResolver([], "/usr/local/bin/yt-dlp");

    expect(resolver.resolve("yt-dlp")).toBe(
      path.resolve("/usr/local/bin/yt-dlp"),
    );
    expect(which).toHaveBeenCalledWith("yt-dlp");
  });

  it("returns null when the binary is found nowhere", () => {
    const { resolver } = makeResolver([], null);

    expect(resolver.resolve("yt-dlp")).toBeNull();
  });

  it("ignores unset dirs and still consults PATH", () => {
    const which = vi.fn().mockReturnValue("/usr/bin/yt-dlp");
    const resolver = new BundledBinaryResolver({
      exists: () => false,
      which,
    });

    expect(resolver.resolve("yt-dlp")).toBe(path.resolve("/usr/bin/yt-dlp"));
  });
});
