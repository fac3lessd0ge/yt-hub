import { describe, expect, it } from "vitest";
import { YtDlpProgressParser } from "~/download";

describe("YtDlpProgressParser fuzz", () => {
  const parser = new YtDlpProgressParser();

  it("never throws on random input", () => {
    const inputs = [
      "", " ", "\0", "\n", "random text",
      "[download]", "[download] ", "[download] 50%",
      "[download] abc% of 10MiB at 1MiB/s ETA 00:01",
      "[download] -1% of 10MiB at 1MiB/s ETA 00:01",
      "[download] 999% of 10MiB at 1MiB/s ETA 00:01",
      "[download] 50.0% of",
      "[download] 50.0% of 10MiB at",
      "[download] 50.0% of 10MiB at 1MiB/s ETA",
      "a".repeat(10000),
      "[download] NaN% of NaN at NaN ETA NaN",
    ];
    for (const input of inputs) {
      const result = parser.parseLine(input);
      expect(result === null || typeof result.percent === "number").toBe(true);
    }
  });

  it("returns valid percent range for matching lines", () => {
    const lines = [
      "[download]   0.0% of  10.00MiB at  1.00MiB/s ETA 00:10",
      "[download]  50.0% of  10.00MiB at  2.00MiB/s ETA 00:05",
      "[download]  99.9% of  10.00MiB at  5.00MiB/s ETA 00:01",
      "[download] 100% of   10.00MiB in 00:03",
    ];
    for (const line of lines) {
      const result = parser.parseLine(line);
      if (result) {
        expect(result.percent).toBeGreaterThanOrEqual(0);
        expect(result.percent).toBeLessThanOrEqual(100);
        expect(typeof result.speed).toBe("string");
        expect(typeof result.eta).toBe("string");
      }
    }
  });
});
