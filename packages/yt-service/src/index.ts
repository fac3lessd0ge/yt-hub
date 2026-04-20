import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { DownloadService } from "yt-downloader";
import { loadConfig } from "~/config";
import {
  BackendsHandler,
  DownloadHandler,
  FormatsHandler,
  MetadataHandler,
} from "~/handlers";
import { InternalHttpServer } from "~/internalHttp";
import { createLogger } from "~/logger";
import { PinoLoggerAdapter } from "~/logger/pinoLoggerAdapter";
import { ErrorMapper, ResponseMapper } from "~/mapping";
import { GrpcServer } from "~/server";

const serviceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(serviceRoot, "..", "..");
// Package `.env` must override root (dotenv does not replace existing keys by default).
loadDotenv({ path: resolve(repoRoot, ".env") });
loadDotenv({ path: resolve(serviceRoot, ".env"), override: true });

const logger = createLogger(process.env.LOG_LEVEL ?? "info");
const config = loadConfig(logger);

const downloadLogger = new PinoLoggerAdapter(
  logger.child({ component: "yt-downloader" }),
);
const downloadService = new DownloadService({ logger: downloadLogger });
const errorMapper = new ErrorMapper();
const responseMapper = new ResponseMapper();

const metadataHandler = new MetadataHandler(downloadService, responseMapper);
const formatsHandler = new FormatsHandler(downloadService, responseMapper);
const backendsHandler = new BackendsHandler(downloadService);
const downloadHandler = new DownloadHandler(
  downloadService,
  errorMapper,
  responseMapper,
  config.downloadDir,
);

const server = new GrpcServer(
  metadataHandler,
  formatsHandler,
  backendsHandler,
  downloadHandler,
  { maxMessageSize: config.maxMessageSize },
  logger,
);
const internalHttpServer = new InternalHttpServer(
  {
    host: config.internalHttpHost,
    port: config.internalHttpPort,
    downloadDir: config.downloadDir,
    fileDeliveryMode: config.fileDeliveryMode,
    internalApiKey: config.internalApiKey,
  },
  logger,
);

let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, "Received signal, starting graceful shutdown");

  try {
    await internalHttpServer.stop();
    logger.info("Internal HTTP server stopped gracefully");
    await server.stop();
    logger.info("gRPC server stopped gracefully");
    process.exit(0);
  } catch (err) {
    logger.error({ err }, "Error during graceful shutdown");
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

async function bootstrap(): Promise<void> {
  await internalHttpServer.start();
  logger.info(
    { host: config.internalHttpHost, port: config.internalHttpPort },
    "Internal HTTP server listening",
  );

  try {
    await server.start(config.host, config.port);
  } catch (err) {
    logger.error({ err }, "gRPC failed to start, stopping internal HTTP");
    try {
      await internalHttpServer.stop();
    } catch (stopErr) {
      logger.error(
        { stopErr },
        "Failed to stop internal HTTP after gRPC failure",
      );
    }
    throw err;
  }

  logger.info(
    { host: config.host, port: config.port },
    "gRPC server listening",
  );
}

bootstrap().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
