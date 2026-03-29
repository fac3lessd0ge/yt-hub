import type { ILogger } from "../types/ILogger";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class ConsoleLogger implements ILogger {
  private minPriority: number;

  constructor(level: LogLevel = "info") {
    this.minPriority = LEVEL_PRIORITY[level];
  }

  debug(message: string): void {
    if (this.minPriority > LEVEL_PRIORITY.debug) return;
    console.debug(this.format("DEBUG", message));
  }

  info(message: string): void {
    if (this.minPriority > LEVEL_PRIORITY.info) return;
    console.log(this.format("INFO", message));
  }

  warn(message: string): void {
    if (this.minPriority > LEVEL_PRIORITY.warn) return;
    console.warn(this.format("WARN", message));
  }

  error(message: string): void {
    if (this.minPriority > LEVEL_PRIORITY.error) return;
    console.error(this.format("ERROR", message));
  }

  private format(level: string, message: string): string {
    return `[${new Date().toISOString()}] [${level}] ${message}`;
  }
}
