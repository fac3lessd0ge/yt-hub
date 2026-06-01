import type { YtDlpConfig } from "~/config";
import type { IBinaryResolver } from "~/dependencies";
import type { IProcessSpawner } from "~/process";
import { capabilities, detectSource } from "~/source";
import { MetadataError } from "../errors/MetadataError";
import type {
  IMetadataFetcher,
  VideoMetadata,
} from "../types/IMetadataFetcher";

const DEFAULT_TIMEOUT_MS = 30000;

interface YtDlpJson {
  title?: unknown;
  uploader?: unknown;
  channel?: unknown;
  uploader_id?: unknown;
  thumbnail?: unknown;
  duration?: unknown;
  vcodec?: unknown;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

export class YtDlpMetadataFetcher implements IMetadataFetcher {
  constructor(
    private spawner: IProcessSpawner,
    private binaryResolver: IBinaryResolver,
    private config?: YtDlpConfig,
  ) {}

  async fetch(videoUrl: string, signal?: AbortSignal): Promise<VideoMetadata> {
    const ytDlpPath = this.binaryResolver.resolve("yt-dlp");
    if (!ytDlpPath) {
      throw new MetadataError(
        "yt-dlp is not installed. Install it (e.g. brew install yt-dlp) and try again.",
      );
    }

    const args = [
      ytDlpPath,
      "--skip-download",
      "--dump-single-json",
      "--no-playlist",
    ];

    if (this.config?.proxy) {
      args.push("--proxy", this.config.proxy);
    }
    if (this.config?.cookiesFile) {
      args.push("--cookies", this.config.cookiesFile);
    }
    if (this.config?.cookiesFromBrowser) {
      args.push("--cookies-from-browser", this.config.cookiesFromBrowser);
    }
    if (this.config?.socketTimeout !== undefined) {
      args.push("--socket-timeout", String(this.config.socketTimeout));
    }

    args.push(videoUrl);

    const lines: string[] = [];
    const result = await this.spawner.spawn(args, {
      stdout: "pipe",
      stderr: "pipe",
      signal,
      timeout: DEFAULT_TIMEOUT_MS,
      onStdout: (line) => {
        lines.push(line);
      },
    });

    if (result.exitCode !== 0) {
      throw new MetadataError(
        "Could not fetch metadata: the media was not found or requires login.",
      );
    }

    let data: YtDlpJson;
    try {
      data = JSON.parse(lines.join("\n")) as YtDlpJson;
    } catch {
      throw new MetadataError("Could not parse metadata returned by yt-dlp.");
    }

    const title = asString(data.title);
    if (!title) {
      throw new MetadataError(
        "Could not fetch metadata: the media was not found or requires login.",
      );
    }

    const authorName =
      asString(data.uploader) ??
      asString(data.channel) ??
      asString(data.uploader_id) ??
      "Unknown";

    const thumbnail = asString(data.thumbnail);
    const durationSec =
      typeof data.duration === "number" ? data.duration : undefined;
    const source = detectSource(videoUrl)?.source;
    // "no video codec" => audio. When vcodec is absent (some dumps omit the
    // top-level codec), only infer audio-only for inherently-audio sources
    // (SoundCloud/Bandcamp) — never flip a video source on missing data.
    const sourceAudioOnly = source ? capabilities(source).audioOnly : false;
    const isAudioOnly =
      data.vcodec === "none" || (data.vcodec === undefined && sourceAudioOnly);

    return {
      title,
      authorName,
      thumbnail,
      durationSec,
      isAudioOnly,
      source,
    };
  }
}
