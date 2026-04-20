import type { Logger } from "~/logger";

export interface ServiceConfig {
  host: string;
  port: number;
  logLevel: string;
  requestTimeoutMs: number;
  maxMessageSize: number;
  downloadDir: string;
  internalHttpHost: string;
  internalHttpPort: number;
  internalApiKey?: string;
}

export function loadConfig(logger: Logger): ServiceConfig {
  const host = process.env.GRPC_HOST ?? "0.0.0.0";
  const port = Number(process.env.GRPC_PORT ?? 50051);
  const logLevel = process.env.LOG_LEVEL ?? "info";
  const requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS ?? 30000);
  const maxMessageSize = Number(process.env.MAX_MESSAGE_SIZE ?? 4194304);
  const downloadDir =
    process.env.DOWNLOAD_DIR ?? "/home/appuser/Downloads/yt-downloader";
  const internalHttpHost = process.env.INTERNAL_HTTP_HOST ?? "0.0.0.0";
  const internalHttpPort = Number(process.env.INTERNAL_HTTP_PORT ?? 8081);
  const internalApiKey = process.env.INTERNAL_API_KEY;

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `Invalid GRPC_PORT: ${process.env.GRPC_PORT}. Must be an integer between 1 and 65535.`,
    );
  }

  if (!Number.isFinite(requestTimeoutMs) || requestTimeoutMs <= 0) {
    throw new Error(
      `Invalid REQUEST_TIMEOUT_MS: ${process.env.REQUEST_TIMEOUT_MS}. Must be a positive number.`,
    );
  }

  if (!Number.isFinite(maxMessageSize) || maxMessageSize <= 0) {
    throw new Error(
      `Invalid MAX_MESSAGE_SIZE: ${process.env.MAX_MESSAGE_SIZE}. Must be a positive number.`,
    );
  }

  if (!Number.isInteger(internalHttpPort) || internalHttpPort < 1 || internalHttpPort > 65535) {
    throw new Error(
      `Invalid INTERNAL_HTTP_PORT: ${process.env.INTERNAL_HTTP_PORT}. Must be an integer between 1 and 65535.`,
    );
  }

  if (!downloadDir.trim()) {
    throw new Error("DOWNLOAD_DIR must not be empty.");
  }

  const config: ServiceConfig = {
    host,
    port,
    logLevel,
    requestTimeoutMs,
    maxMessageSize,
    downloadDir,
    internalHttpHost,
    internalHttpPort,
    internalApiKey: internalApiKey?.trim() || undefined,
  };

  logger.info({ config }, "Resolved service config");

  return config;
}
