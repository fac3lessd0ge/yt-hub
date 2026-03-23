import type { DownloadService } from "yt-downloader";
import type { IUnaryHandler } from "../types/IHandler";

export class BackendsHandler implements IUnaryHandler<Record<string, never>, any> {
  constructor(private downloadService: DownloadService) {}

  async handle() {
    return {
      backends: this.downloadService.listBackends(),
    };
  }
}
