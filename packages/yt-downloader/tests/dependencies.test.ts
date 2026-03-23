import { describe, expect, it } from "vitest";
import type { IBinaryResolver } from "~/dependencies";
import { DependencyChecker, DependencyError } from "~/dependencies";

function fakeResolver(
  available: Record<string, string | null>,
): IBinaryResolver {
  return { resolve: (bin) => available[bin] ?? null };
}

const TEST_DEPS = [
  { binary: "yt-dlp", installHint: "brew install yt-dlp" },
  { binary: "ffmpeg", installHint: "brew install ffmpeg" },
];

describe("DependencyChecker", () => {
  it("passes when all dependencies are found", () => {
    const checker = new DependencyChecker(
      fakeResolver({ "yt-dlp": "/usr/bin/yt-dlp", ffmpeg: "/usr/bin/ffmpeg" }),
    );
    expect(() => checker.check(TEST_DEPS)).not.toThrow();
  });

  it("throws DependencyError when yt-dlp is missing", () => {
    const checker = new DependencyChecker(
      fakeResolver({ ffmpeg: "/usr/bin/ffmpeg" }),
    );
    expect(() => checker.check(TEST_DEPS)).toThrow(DependencyError);
    try {
      checker.check(TEST_DEPS);
    } catch (e) {
      expect((e as DependencyError).message).toContain(
        "yt-dlp is not installed",
      );
    }
  });

  it("throws DependencyError when ffmpeg is missing", () => {
    const checker = new DependencyChecker(
      fakeResolver({ "yt-dlp": "/usr/bin/yt-dlp" }),
    );
    expect(() => checker.check(TEST_DEPS)).toThrow(DependencyError);
    try {
      checker.check(TEST_DEPS);
    } catch (e) {
      expect((e as DependencyError).message).toContain(
        "ffmpeg is not installed",
      );
    }
  });

  it("passes with empty dependency list", () => {
    expect(() =>
      new DependencyChecker(fakeResolver({})).check([]),
    ).not.toThrow();
  });

  it("checks custom dependency list", () => {
    expect(() =>
      new DependencyChecker(fakeResolver({})).check([
        { binary: "custom-tool", installHint: "brew install custom-tool" },
      ]),
    ).toThrow(DependencyError);
  });
});
