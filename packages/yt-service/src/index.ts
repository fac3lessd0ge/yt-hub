import { DownloadService } from "yt-downloader";
import { loadConfig } from "~/config";
import {
  BackendsHandler,
  DownloadHandler,
  FormatsHandler,
  MetadataHandler,
} from "~/handlers";
import { ErrorMapper, ResponseMapper } from "~/mapping";
import { GrpcServer } from "~/server";

const config = loadConfig();

const downloadService = new DownloadService();
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
);

let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`Received ${signal}, starting graceful shutdown...`);

  try {
    await server.stop();
    console.log("gRPC server stopped gracefully");
    process.exit(0);
  } catch (err) {
    console.error("Error during graceful shutdown:", err);
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

server
  .start(config.host, config.port)
  .then(() => console.log(`gRPC server listening on ${config.host}:${config.port}`))
  .catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
