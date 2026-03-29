export interface ServiceConfig {
  host: string;
  port: number;
  logLevel: string;
  requestTimeoutMs: number;
  maxMessageSize: number;
}

export function loadConfig(): ServiceConfig {
  const host = process.env.GRPC_HOST ?? "0.0.0.0";
  const port = Number(process.env.GRPC_PORT ?? 50051);
  const logLevel = process.env.LOG_LEVEL ?? "info";
  const requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS ?? 30000);
  const maxMessageSize = Number(process.env.MAX_MESSAGE_SIZE ?? 4194304);

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

  const config: ServiceConfig = {
    host,
    port,
    logLevel,
    requestTimeoutMs,
    maxMessageSize,
  };

  console.log("Resolved service config:", {
    host: config.host,
    port: config.port,
    logLevel: config.logLevel,
    requestTimeoutMs: config.requestTimeoutMs,
    maxMessageSize: config.maxMessageSize,
  });

  return config;
}
