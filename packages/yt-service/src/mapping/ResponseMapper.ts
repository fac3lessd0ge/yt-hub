import type {
  VideoMetadata,
  FormatInfo,
  DownloadProgress,
  DownloadResult,
} from "yt-downloader";

export class ResponseMapper {
  toMetadataResponse(metadata: VideoMetadata) {
    return {
      title: metadata.title,
      author_name: metadata.authorName,
    };
  }

  toFormatInfo(format: FormatInfo) {
    return {
      id: format.id,
      label: format.label,
    };
  }

  toDownloadProgress(progress: DownloadProgress) {
    return {
      progress: {
        percent: progress.percent,
        speed: progress.speed,
        eta: progress.eta,
      },
    };
  }

  toDownloadComplete(result: DownloadResult) {
    return {
      complete: {
        output_path: result.outputPath,
        title: result.metadata.title,
        author_name: result.metadata.authorName,
        format_id: result.format.id,
        format_label: result.format.label,
      },
    };
  }

  toDownloadError(code: string, message: string) {
    return {
      error: { code, message },
    };
  }
}
