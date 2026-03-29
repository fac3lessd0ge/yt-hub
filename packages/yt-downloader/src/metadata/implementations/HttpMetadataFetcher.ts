import { MetadataError } from "../errors/MetadataError";
import type {
  IMetadataFetcher,
  VideoMetadata,
} from "../types/IMetadataFetcher";

const DEFAULT_TIMEOUT_MS = 10000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [1000, 3000];

function isRetryable(err: unknown): boolean {
  if (err instanceof MetadataError) {
    return err.statusCode !== undefined && err.statusCode >= 500;
  }
  return true;
}

function combinedSignal(
  signal?: AbortSignal,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!signal) return timeoutSignal;
  return AbortSignal.any([signal, timeoutSignal]);
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

export class HttpMetadataFetcher implements IMetadataFetcher {
  private static readonly OEMBED_URL = "https://www.youtube.com/oembed";

  async fetch(videoUrl: string, signal?: AbortSignal): Promise<VideoMetadata> {
    const url = `${HttpMetadataFetcher.OEMBED_URL}?url=${encodeURIComponent(videoUrl)}&format=json`;

    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        await delay(RETRY_DELAYS_MS[attempt - 1], signal);
      }

      try {
        const fetchSignal = combinedSignal(signal);
        return await this.attemptFetch(url, fetchSignal);
      } catch (err) {
        lastError = err;
        if (!isRetryable(err) || attempt === MAX_ATTEMPTS - 1) {
          throw err;
        }
      }
    }

    throw lastError;
  }

  private async attemptFetch(
    url: string,
    signal: AbortSignal,
  ): Promise<VideoMetadata> {
    let response: Response;
    try {
      response = await globalThis.fetch(url, { signal });
    } catch {
      throw new MetadataError("Network error while fetching video metadata");
    }

    if (!response.ok) {
      throw new MetadataError(
        response.status === 404
          ? "Video not found. Check the URL and try again."
          : `Failed to fetch video metadata (HTTP ${response.status})`,
        response.status,
      );
    }

    const data = await response.json();

    if (
      typeof data.title !== "string" ||
      !data.title ||
      typeof data.author_name !== "string" ||
      !data.author_name
    ) {
      throw new MetadataError(
        "Invalid metadata response: missing title or author_name",
      );
    }

    return { title: data.title, authorName: data.author_name };
  }
}
