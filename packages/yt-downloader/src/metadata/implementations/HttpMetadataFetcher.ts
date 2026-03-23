import { MetadataError } from "../errors/MetadataError";
import type {
  IMetadataFetcher,
  VideoMetadata,
} from "../types/IMetadataFetcher";

export class HttpMetadataFetcher implements IMetadataFetcher {
  private static readonly OEMBED_URL = "https://www.youtube.com/oembed";

  async fetch(videoUrl: string): Promise<VideoMetadata> {
    const url = `${HttpMetadataFetcher.OEMBED_URL}?url=${encodeURIComponent(videoUrl)}&format=json`;

    let response: Response;
    try {
      response = await globalThis.fetch(url);
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
    return { title: data.title, authorName: data.author_name };
  }
}
