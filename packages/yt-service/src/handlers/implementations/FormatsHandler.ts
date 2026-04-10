import type { DownloadService } from "yt-downloader";
import type {
  ListFormatsRequest,
  ListFormatsResponse,
} from "~/generated/yt_service";
import type { ResponseMapper } from "~/mapping";
import type { IUnaryHandler } from "../types/IHandler";

export class FormatsHandler
  implements IUnaryHandler<ListFormatsRequest, ListFormatsResponse>
{
  constructor(
    private downloadService: DownloadService,
    private responseMapper: ResponseMapper,
  ) {}

  async handle(): Promise<ListFormatsResponse> {
    const formats = this.downloadService.listFormats();
    return this.responseMapper.toFormatsResponse(formats);
  }
}
