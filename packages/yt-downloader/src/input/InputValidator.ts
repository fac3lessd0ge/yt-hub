import { homedir } from "node:os";
import { resolve } from "node:path";
import type { IDownloadBackend } from "~/download";
import { detectSource, type MediaSource } from "~/source";
import { ValidationError } from "./errors/ValidationError";
import type { RawInput } from "./types/IInputReader";

export const DEFAULT_DESTINATION = resolve(
  homedir(),
  "Downloads",
  "yt-downloader",
);

export interface ValidatedInput {
  link: string;
  name: string;
  formatId: string;
  destination: string;
  source: MediaSource;
}

export class InputValidator {
  constructor(private backend: IDownloadBackend) {}

  validate(raw: RawInput): ValidatedInput {
    if (!raw.link || !raw.name) {
      throw new ValidationError("link and name are required.");
    }

    const supportedIds = this.backend.supportedFormats().map((f) => f.id);

    if (!raw.format) {
      throw new ValidationError(
        `format is required. Use ${supportedIds.join(" or ")}, or use download:song / download:video scripts.`,
      );
    }

    const formatId = raw.format.toLowerCase();
    if (!supportedIds.includes(formatId)) {
      throw new ValidationError(
        `Unsupported format "${raw.format}". Use ${supportedIds.join(" or ")}.`,
      );
    }

    const detected = detectSource(raw.link);
    if (!detected) {
      throw new ValidationError(
        "URL is not from a supported source (YouTube, SoundCloud, VK, Bandcamp).",
      );
    }
    if (detected.kind === "playlist") {
      throw new ValidationError(
        "Playlists/albums aren't supported yet — provide a single track or video URL.",
      );
    }

    const destination = resolve(raw.destination ?? DEFAULT_DESTINATION);

    return {
      link: raw.link,
      name: raw.name,
      formatId,
      destination,
      source: detected.source,
    };
  }
}
