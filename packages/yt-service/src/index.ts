import { DownloadService } from "yt-downloader";
import { loadConfig } from "~/config";
import {
  BackendsHandler,
  DownloadHandler,
  FormatsHandler,
  MetadataHandler,
} from "~/handlers";
import { createLogger } from "~/logger";
import { PinoLoggerAdapter } from "~/logger/pinoLoggerAdapter";
import { ErrorMapper, ResponseMapper } from "~/mapping";
import { InternalHttpServer } from "~/internalHttp";
import { GrpcServer } from "~/server";

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

Promise.all([
  internalHttpServer.start().then(() => {
    logger.info(
      { host: config.internalHttpHost, port: config.internalHttpPort },
      "Internal HTTP server listening",
    );
  }),
  server.start(config.host, config.port).then(() => {
    logger.info(
      { host: config.host, port: config.port },
      "gRPC server listening",
    );
  }),
]).catch((err) => {
    logger.error({ err }, "Failed to start server");
    process.exit(1);
  });
