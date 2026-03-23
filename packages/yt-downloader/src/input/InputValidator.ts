import { homedir } from "node:os";
import { resolve } from "node:path";
import type { IDownloadBackend } from "~/download";
import { ValidationError } from "./errors/ValidationError";
import type { RawInput } from "./types/IInputReader";

export const YOUTUBE_PATTERNS = [
  "youtube.com/watch",
  "youtu.be/",
  "youtube.com/shorts/",
];

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

    if (!YOUTUBE_PATTERNS.some((pattern) => raw.link?.includes(pattern))) {
      throw new ValidationError("URL does not look like a YouTube link.");
    }

    const destination = resolve(raw.destination ?? DEFAULT_DESTINATION);

    return { link: raw.link, name: raw.name, formatId, destination };
  }
}
