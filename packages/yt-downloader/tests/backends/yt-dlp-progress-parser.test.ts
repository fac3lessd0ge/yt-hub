import { describe, expect, it } from "vitest";
import { YtDlpProgressParser } from "~/download";

describe("YtDlpProgressParser", () => {
  const parser = new YtDlpProgressParser();

  it("parses a standard progress line", () => {
    const result = parser.parseLine(
      "[download]  45.2% of  12.34MiB at  2.50MiB/s ETA 00:05",
    );
    expect(result).toEqual({
      percent: 45.2,
      speed: "2.50MiB/s",
      eta: "00:05",
    });
  });

  it("parses a progress line with approximate size", () => {
    const result = parser.parseLine(
      "[download]  10.0% of ~  50.00MiB at  1.00MiB/s ETA 00:45",
    );
    expect(result).toEqual({
      percent: 10.0,
      speed: "1.00MiB/s",
      eta: "00:45",
    });
  });

  it("parses 0% progress", () => {
    const result = parser.parseLine(
      "[download]   0.0% of  100.00MiB at  500.00KiB/s ETA 03:24",
    );
    expect(result).toEqual({
      percent: 0.0,
      speed: "500.00KiB/s",
      eta: "03:24",
    });
  });

  it("parses integer percentage", () => {
    const result = parser.parseLine(
      "[download]  50% of  20.00MiB at  5.00MiB/s ETA 00:02",
    );
    expect(result).toEqual({
      percent: 50,
      speed: "5.00MiB/s",
      eta: "00:02",
    });
  });

  it("returns null for non-progress lines", () => {
    expect(parser.parseLine("[info] Extracting URL")).toBeNull();
    expect(
      parser.parseLine("[download] Destination: /tmp/test.mp3"),
    ).toBeNull();
    expect(parser.parseLine("")).toBeNull();
  });

  it("parses 100% completion line", () => {
    const result = parser.parseLine("[download] 100% of   12.34MiB in 00:04");
    expect(result).toEqual({
      percent: 100,
      speed: "done",
      eta: "00:00",
    });
  });

  it("handles Unknown speed and ETA", () => {
    const result = parser.parseLine(
      "[download]  25.0% of  10.00MiB at Unknown speed ETA Unknown",
    );
    expect(result).toEqual({
      percent: 25.0,
      speed: "unknown",
      eta: "unknown",
    });
  });
});
