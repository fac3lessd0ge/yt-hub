import { status as GrpcStatus } from "@grpc/grpc-js";

export class RequestValidator {
  validateMetadataRequest(request: { link?: string }): void {
    if (!request.link || request.link.trim() === "") {
      throw this.createError("link is required");
    }
  }

  validateDownloadRequest(request: {
    link?: string;
    format?: string;
    name?: string;
  }): void {
    if (!request.link || request.link.trim() === "") {
      throw this.createError("link is required");
    }
    if (!request.format || request.format.trim() === "") {
      throw this.createError("format is required");
    }
    if (!request.name || request.name.trim() === "") {
      throw this.createError("name is required");
    }
  }

  private createError(message: string): Error & { code: number } {
    const err = new Error(message) as Error & { code: number };
    err.code = GrpcStatus.INVALID_ARGUMENT;
    return err;
  }
}
