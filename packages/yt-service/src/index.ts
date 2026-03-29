import { DownloadService } from "yt-downloader";
import {
  BackendsHandler,
  DownloadHandler,
  FormatsHandler,
  MetadataHandler,
} from "~/handlers";
import { ErrorMapper, ResponseMapper } from "~/mapping";
import { GrpcServer } from "~/server";

const HOST = process.env.GRPC_HOST ?? "0.0.0.0";
const PORT = Number(process.env.GRPC_PORT ?? 50051);

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
  .start(HOST, PORT)
  .then(() => console.log(`gRPC server listening on ${HOST}:${PORT}`))
  .catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
