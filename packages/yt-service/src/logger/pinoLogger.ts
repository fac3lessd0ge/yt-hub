import pino, { type Logger } from "pino";

export type { Logger };

export function createLogger(level = "info"): Logger {
  return pino({
    level,
    timestamp: pino.stdTimeFunctions.isoTime,
    base: { service: "yt-service" },
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  });
}
