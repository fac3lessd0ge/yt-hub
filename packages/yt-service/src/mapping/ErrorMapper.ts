import { status as GrpcStatus } from "@grpc/grpc-js";
import { DownloadError, ValidationError } from "yt-downloader";
import {
  CANCELLED,
  DEPENDENCY_MISSING,
  DOWNLOAD_FAILED,
  INTERNAL_ERROR,
  METADATA_FAILED,
  REQUEST_TIMEOUT,
  VALIDATION_ERROR,
  VIDEO_NOT_FOUND,
} from "~/errorCodes";

export interface MappedError {
  code: string;
  message: string;
  grpcStatus: number;
  retryable: boolean;
}

export class ErrorMapper {
  mapError(err: unknown): MappedError {
    if (err instanceof ValidationError) {
      return {
        code: VALIDATION_ERROR,
        message: err.message,
        grpcStatus: GrpcStatus.INVALID_ARGUMENT,
        retryable: false,
      };
    }

    if (err instanceof DownloadError) {
      return {
        code: DOWNLOAD_FAILED,
        message: err.message,
        grpcStatus: GrpcStatus.INTERNAL,
        retryable: false,
      };
    }

    if (err instanceof Error && err.name === "CancellationError") {
      return {
        code: CANCELLED,
        message: err.message,
        grpcStatus: GrpcStatus.CANCELLED,
        retryable: false,
      };
    }

    if (err instanceof Error && err.name === "MetadataError") {
      const statusCode = (err as Error & { statusCode?: number }).statusCode;
      if (statusCode === 404) {
        return {
          code: VIDEO_NOT_FOUND,
          message: err.message,
          grpcStatus: GrpcStatus.NOT_FOUND,
          retryable: false,
        };
      }
      return {
        code: METADATA_FAILED,
        message: err.message,
        grpcStatus: GrpcStatus.UNAVAILABLE,
        retryable: true,
      };
    }

    if (err instanceof Error && err.name === "DependencyError") {
      return {
        code: DEPENDENCY_MISSING,
        message: err.message,
        grpcStatus: GrpcStatus.FAILED_PRECONDITION,
        retryable: false,
      };
    }

    if (err instanceof Error && err.name === "TimeoutError") {
      return {
        code: REQUEST_TIMEOUT,
        message: err.message,
        grpcStatus: GrpcStatus.DEADLINE_EXCEEDED,
        retryable: true,
      };
    }

    const message = err instanceof Error ? err.message : String(err);
    return {
      code: INTERNAL_ERROR,
      message,
      grpcStatus: GrpcStatus.INTERNAL,
      retryable: false,
    };
  }
}
