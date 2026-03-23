import type { IDownloadBackend, FormatInfo } from "../types/IDownloadBackend";
import type { ProgressCallback } from "../types/DownloadProgress";
import type { IProcessSpawner } from "~/process";
import type { Dependency } from "~/dependencies";
import { DownloadError } from "../errors/DownloadError";
import { YtDlpProgressParser } from "./YtDlpProgressParser";

const FORMAT_ARGS: Record<string, string[]> = {
  mp3: ["-x", "--audio-format", "mp3", "--audio-quality", "0"],
  mp4: [
    "-f",
    "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b",
    "--merge-output-format",
    "mp4",
  ],
};

const FORMAT_LABELS: Record<string, string> = {
  mp3: "MP3 audio",
  mp4: "MP4 video",
};

export class YtDlpBackend implements IDownloadBackend {
  readonly name = "yt-dlp";
  private progressParser = new YtDlpProgressParser();

  constructor(private spawner: IProcessSpawner) {}

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
    onProgress?: ProgressCallback
  ): Promise<void> {
    const formatArgs = FORMAT_ARGS[formatId];
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
      link,
    ];

    const usePipe = !!onProgress;

    const result = await this.spawner.spawn(args, {
      stdout: usePipe ? "pipe" : "inherit",
      stderr: usePipe ? "pipe" : "inherit",
      onStdout: onProgress
        ? (line) => {
            const progress = this.progressParser.parseLine(line);
            if (progress) onProgress(progress);
          }
        : undefined,
    });

    if (result.exitCode !== 0) {
      throw new DownloadError(result.exitCode);
    }
  }
}
