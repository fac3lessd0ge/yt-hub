import type { DownloadProgress } from "../types/DownloadProgress";

const PROGRESS_RE =
  /\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+~?\s*\S+\s+at\s+(.+?)\s+ETA\s+(\S+)/;

const COMPLETE_RE =
  /\[download\]\s+100(?:\.0)?%\s+of\s+~?\s*\S+\s+in\s+\S+/;

export class YtDlpProgressParser {
  parseLine(line: string): DownloadProgress | null {
    if (COMPLETE_RE.test(line)) {
      return { percent: 100, speed: "done", eta: "00:00" };
    }

    const match = line.match(PROGRESS_RE);
    if (!match) return null;

    const speed = match[2].trim();
    const eta = match[3];

    return {
      percent: parseFloat(match[1]),
      speed: speed === "Unknown speed" ? "unknown" : speed,
      eta: eta === "Unknown" ? "unknown" : eta,
    };
  }
}
