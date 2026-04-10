import type {
  DownloadProgress,
  DownloadResult,
  FormatInfo,
  VideoMetadata,
} from "yt-downloader";
import type {
  GetMetadataResponse,
  ListFormatsResponse,
  DownloadComplete as ProtoDownloadComplete,
  DownloadError as ProtoDownloadError,
  DownloadProgress as ProtoDownloadProgress,
  FormatInfo as ProtoFormatInfo,
} from "~/generated/yt_service";

// proto-loader uses flat oneof fields (not $case discriminated unions).
// These types represent the wire format that @grpc/proto-loader sends.
export interface DownloadProgressMessage {
  progress: ProtoDownloadProgress;
}

export interface DownloadCompleteMessage {
  complete: ProtoDownloadComplete;
}

export interface DownloadErrorMessage {
  error: ProtoDownloadError;
}

export type DownloadStreamMessage =
  | DownloadProgressMessage
  | DownloadCompleteMessage
  | DownloadErrorMessage;

export class ResponseMapper {
  toMetadataResponse(metadata: VideoMetadata): GetMetadataResponse {
    return {
      title: metadata.title,
      author_name: metadata.authorName,
    };
  }

  toFormatInfo(format: FormatInfo): ProtoFormatInfo {
    return {
      id: format.id,
      label: format.label,
    };
  }

  toFormatsResponse(formats: FormatInfo[]): ListFormatsResponse {
    return {
      formats: formats.map((f) => this.toFormatInfo(f)),
    };
  }

  toDownloadProgress(progress: DownloadProgress): DownloadProgressMessage {
    return {
      progress: {
        percent: progress.percent,
        speed: progress.speed,
        eta: progress.eta,
      },
    };
  }

  toDownloadComplete(result: DownloadResult): DownloadCompleteMessage {
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

  toDownloadError(code: string, message: string): DownloadErrorMessage {
    return {
      error: { code, message },
    };
  }
}
