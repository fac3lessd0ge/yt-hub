import type { z } from "zod";
import type { VideoMetadataSchema } from "~/schemas";

export type VideoMetadata = z.infer<typeof VideoMetadataSchema>;

export interface IMetadataFetcher {
  fetch(videoUrl: string, signal?: AbortSignal): Promise<VideoMetadata>;
}
