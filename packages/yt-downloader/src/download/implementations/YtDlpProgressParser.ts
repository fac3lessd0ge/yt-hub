import type { DownloadProgress } from "../types/DownloadProgress";

const PROGRESS_RE =
  /\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+~?\s*\S+\s+at\s+(\S+)\s+ETA\s+(\S+)/;

export class YtDlpProgressParser {
  parseLine(line: string): DownloadProgress | null {
    const match = line.match(PROGRESS_RE);
    if (!match) return null;
    return {
      percent: parseFloat(match[1]),
      speed: match[2],
      eta: match[3],
    };
  }
}
