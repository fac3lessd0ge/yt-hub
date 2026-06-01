import { dirname } from "node:path";
import type { YtDlpConfig } from "~/config";
import type { Dependency } from "~/dependencies";
import type { IProcessSpawner } from "~/process";
import { DownloadError } from "../errors/DownloadError";
import type { ProgressCallback } from "../types/DownloadProgress";
import type { FormatInfo, IDownloadBackend } from "../types/IDownloadBackend";
import { YtDlpProgressParser } from "./YtDlpProgressParser";

const DEFAULT_AUDIO_QUALITY = "0";

function buildFormatArgs(audioQuality: string): Record<string, string[]> {
  return {
    // mp3: embed title/artist tags + the YouTube thumbnail as cover art.
    // Cover art for mp3 only needs ffmpeg (no AtomicParsley); convert the
    // (often webp) thumbnail to jpg so every player shows it.
    mp3: [
      "-x",
      "--audio-format",
      "mp3",
      "--audio-quality",
      audioQuality,
      "--embed-metadata",
      "--embed-thumbnail",
      "--convert-thumbnails",
      "jpg",
    ],
    // mp4: embed title/artist tags. Thumbnail embedding for mp4/m4a needs
    // AtomicParsley (not bundled), so it is intentionally omitted.
    mp4: [
      "-f",
      "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b",
      "--merge-output-format",
      "mp4",
      "--embed-metadata",
    ],
  };
}

const FORMAT_LABELS: Record<string, string> = {
  mp3: "MP3 audio",
  mp4: "MP4 video",
};

export class YtDlpBackend implements IDownloadBackend {
  readonly name = "yt-dlp";
  private progressParser = new YtDlpProgressParser();
  private config: YtDlpConfig | undefined;

  constructor(
    private spawner: IProcessSpawner,
    config?: YtDlpConfig,
  ) {
    this.config = config;
  }

  supportedFormats(): FormatInfo[] {
    return Object.entries(FORMAT_LABELS).map(([id, label]) => ({ id, label }));
  }

  requiredDependencies(): Dependency[] {
    return [
      { binary: "yt-dlp", installHint: "brew install yt-dlp" },
      { binary: "ffmpeg", installHint: "brew install ffmpeg" },
    ];
  }

  async download(
    link: string,
    outputPath: string,
    formatId: string,
    binaries: ReadonlyMap<string, string>,
    onProgress?: ProgressCallback,
    signal?: AbortSignal,
  ): Promise<void> {
    const audioQuality = this.config?.audioQuality ?? DEFAULT_AUDIO_QUALITY;
    const formatArgsMap = buildFormatArgs(audioQuality);
    const formatArgs = formatArgsMap[formatId];
    if (!formatArgs) {
      throw new DownloadError(1);
    }

    const ytDlpPath = binaries.get("yt-dlp");
    if (!ytDlpPath) {
      // Internal invariant: DependencyChecker resolves required binaries before
      // download() is called, so this signals a wiring bug, not a yt-dlp failure.
      throw new Error(
        "yt-dlp binary path was not resolved; ensure DependencyChecker ran before download()",
      );
    }
    const ffmpegPath = binaries.get("ffmpeg");

    const args = [
      ytDlpPath,
      ...formatArgs,
      "--no-playlist",
      "--continue",
      "-o",
      outputPath,
      "--progress",
      // Emit each progress update on its own line. Without this, yt-dlp uses
      // carriage returns to redraw the progress line in place, and the
      // line-based stdout reader only sees the final newline-terminated line —
      // so progress appears stuck at 0% until the download completes.
      "--newline",
    ];

    if (ffmpegPath) {
      args.push("--ffmpeg-location", dirname(ffmpegPath));
    }

    if (this.config?.proxy) {
      args.push("--proxy", this.config.proxy);
    }

    if (this.config?.cookiesFile) {
      args.push("--cookies", this.config.cookiesFile);
    }

    if (this.config?.socketTimeout !== undefined) {
      args.push("--socket-timeout", String(this.config.socketTimeout));
    }

    if (this.config?.customArgs?.length) {
      args.push(...this.config.customArgs);
    }

    args.push(link);

    const usePipe = !!onProgress;

    const result = await this.spawner.spawn(args, {
      stdout: usePipe ? "pipe" : "inherit",
      stderr: usePipe ? "pipe" : "inherit",
      signal,
      timeout: this.config?.processTimeout
        ? this.config.processTimeout * 1000
        : undefined,
      onStdout: onProgress
        ? (line) => {
            const progress = this.progressParser.parseLine(line);
            if (progress) onProgress(progress);
          }
        : undefined,
    });

    if (result.exitCode === 0 && onProgress) {
      onProgress({ percent: 100, speed: "done", eta: "00:00" });
    }

    if (result.exitCode !== 0) {
      throw new DownloadError(result.exitCode, result.stderr);
    }
  }
}
