import { status as GrpcStatus } from "@grpc/grpc-js";
import { DownloadRequestSchema, MetadataRequestSchema } from "yt-downloader";

/**
 * Minimal validation: field existence only.
 * Full input validation (URL format, path safety, length limits) is
 * handled by yt-api gateway. These checks are a safety net for direct
 * gRPC access.
 */
export class RequestValidator {
  validateMetadataRequest(request: unknown): void {
    const result = MetadataRequestSchema.safeParse(request);
    if (!result.success) {
      throw this.createError(result.error.issues[0].message);
    }
  }

  validateDownloadRequest(request: unknown): void {
    const result = DownloadRequestSchema.safeParse(request);
    if (!result.success) {
      throw this.createError(result.error.issues[0].message);
    }
  }

  private createError(message: string): Error & { code: number } {
    const err = new Error(message) as Error & { code: number };
    err.code = GrpcStatus.INVALID_ARGUMENT;
    return err;
  }
}
