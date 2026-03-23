import type { ILogger } from "../types/ILogger";

export class ConsoleLogger implements ILogger {
  info(message: string): void {
    console.log(message);
  }

  error(message: string): void {
    console.error(message);
  }
}
