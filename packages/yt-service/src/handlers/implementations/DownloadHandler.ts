import type { DownloadService } from "yt-downloader";
import type { ErrorMapper, ResponseMapper } from "~/mapping";
import type { IStreamHandler } from "../types/IHandler";

interface DownloadRequest {
  link: string;
  format: string;
  name: string;
  destination?: string;
  backend?: string;
}

export class DownloadHandler implements IStreamHandler<DownloadRequest, any> {
  constructor(
    private downloadService: DownloadService,
    private errorMapper: ErrorMapper,
    private responseMapper: ResponseMapper,
  ) {}

  async handle(request: DownloadRequest, write: (msg: any) => void) {
    try {
      const result = await this.downloadService.download(
        {
          link: request.link,
          format: request.format,
          name: request.name,
          destination: request.destination,
          backend: request.backend,
        },
        (progress) => {
          write(this.responseMapper.toDownloadProgress(progress));
        },
      );
      write(this.responseMapper.toDownloadComplete(result));
    } catch (err) {
      const mapped = this.errorMapper.mapError(err);
      write(this.responseMapper.toDownloadError(mapped.code, mapped.message));
    }
  }
}
