import type { ILogger } from "yt-downloader/infra";
import type { Logger } from "./pinoLogger";

export class PinoLoggerAdapter implements ILogger {
  constructor(private pino: Logger) {}

  info(message: string): void {
    this.pino.info(message);
  }

  error(message: string): void {
    this.pino.error(message);
  }
}
