import type { DownloadService } from "yt-downloader";
import type { ListBackendsRequest, ListBackendsResponse } from "~/generated/yt_service";
import type { IUnaryHandler } from "../types/IHandler";

export class BackendsHandler
  implements IUnaryHandler<ListBackendsRequest, ListBackendsResponse>
{
  constructor(private downloadService: DownloadService) {}

  async handle(): Promise<ListBackendsResponse> {
    return {
      backends: this.downloadService.listBackends(),
    };
  }
}
