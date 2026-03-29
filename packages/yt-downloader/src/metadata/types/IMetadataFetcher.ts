export interface VideoMetadata {
  title: string;
  authorName: string;
}

export interface IMetadataFetcher {
  fetch(videoUrl: string, signal?: AbortSignal): Promise<VideoMetadata>;
}
