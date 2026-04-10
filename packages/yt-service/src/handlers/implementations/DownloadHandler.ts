import type { DownloadService } from "yt-downloader";
import type { DownloadRequest } from "~/generated/yt_service";
import type { ErrorMapper } from "~/mapping";
import type {
  DownloadStreamMessage,
  ResponseMapper,
} from "~/mapping/ResponseMapper";
import type { IStreamHandler } from "../types/IHandler";

export class DownloadHandler
  implements IStreamHandler<DownloadRequest, DownloadStreamMessage>
{
  constructor(
    private downloadService: DownloadService,
    private errorMapper: ErrorMapper,
    private responseMapper: ResponseMapper,
  ) {}

  async handle(
    request: DownloadRequest,
    write: (msg: DownloadStreamMessage) => void,
    signal?: AbortSignal,
  ) {
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
        signal,
      );
      write(this.responseMapper.toDownloadComplete(result));
    } catch (err) {
      const mapped = this.errorMapper.mapError(err);
      write(this.responseMapper.toDownloadError(mapped.code, mapped.message));
      throw mapped;
    }
  }
}
