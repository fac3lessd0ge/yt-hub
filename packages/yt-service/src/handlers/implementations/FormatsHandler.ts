import type { DownloadService } from "yt-downloader";
import type { ResponseMapper } from "~/mapping";
import type { IUnaryHandler } from "../types/IHandler";

export class FormatsHandler
  implements IUnaryHandler<Record<string, never>, any>
{
  constructor(
    private downloadService: DownloadService,
    private responseMapper: ResponseMapper,
  ) {}

  async handle() {
    const formats = this.downloadService.listFormats();
    return {
      formats: formats.map((f) => this.responseMapper.toFormatInfo(f)),
    };
  }
}
