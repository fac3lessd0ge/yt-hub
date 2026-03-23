import {
  DownloadError,
  ValidationError,
} from "yt-downloader";

export interface MappedError {
  code: string;
  message: string;
}

export class ErrorMapper {
  mapError(err: unknown): MappedError {
    if (err instanceof ValidationError) {
      return { code: "VALIDATION", message: err.message };
    }
    if (err instanceof DownloadError) {
      return { code: "DOWNLOAD", message: err.message };
    }
    if (err instanceof Error && err.name === "MetadataError") {
      return { code: "METADATA", message: err.message };
    }
    if (err instanceof Error && err.name === "DependencyError") {
      return { code: "DEPENDENCY", message: err.message };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { code: "INTERNAL", message };
  }
}
