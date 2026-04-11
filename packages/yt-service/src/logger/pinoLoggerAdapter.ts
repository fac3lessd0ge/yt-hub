import type { ILogger } from "yt-downloader";
import type { Logger } from "./pinoLogger";

export class PinoLoggerAdapter implements ILogger {
  constructor(private pino: Logger) {}

  debug(message: string): void {
    this.pino.debug(message);
  }

  info(message: string): void {
    this.pino.info(message);
  }

  warn(message: string): void {
    this.pino.warn(message);
  }

  error(message: string): void {
    this.pino.error(message);
  }
}
