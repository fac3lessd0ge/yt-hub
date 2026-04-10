import type { DownloadService } from "yt-downloader";
import type {
  GetMetadataRequest,
  GetMetadataResponse,
} from "~/generated/yt_service";
import type { ResponseMapper } from "~/mapping";
import type { IUnaryHandler } from "../types/IHandler";

export class MetadataHandler
  implements IUnaryHandler<GetMetadataRequest, GetMetadataResponse>
{
  constructor(
    private downloadService: DownloadService,
    private responseMapper: ResponseMapper,
  ) {}

  async handle(request: { link: string }) {
    const metadata = await this.downloadService.getMetadata(request.link);
    return this.responseMapper.toMetadataResponse(metadata);
  }
}
