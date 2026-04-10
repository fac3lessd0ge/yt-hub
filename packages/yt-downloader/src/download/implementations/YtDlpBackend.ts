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
    mp3: ["-x", "--audio-format", "mp3", "--audio-quality", audioQuality],
    mp4: [
      "-f",
      "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b",
      "--merge-output-format",
      "mp4",
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
    onProgress?: ProgressCallback,
    signal?: AbortSignal,
  ): Promise<void> {
    const audioQuality = this.config?.audioQuality ?? DEFAULT_AUDIO_QUALITY;
    const formatArgsMap = buildFormatArgs(audioQuality);
    const formatArgs = formatArgsMap[formatId];
    if (!formatArgs) {
      throw new DownloadError(1);
    }

    const args = [
      "yt-dlp",
      ...formatArgs,
      "--no-playlist",
      "-o",
      outputPath,
      "--progress",
    ];

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

    if (result.exitCode !== 0) {
      throw new DownloadError(result.exitCode, result.stderr);
    }
  }
}
