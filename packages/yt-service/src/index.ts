import { DownloadService } from "yt-downloader";
import { ErrorMapper, ResponseMapper } from "~/mapping";
import {
  DownloadHandler,
  MetadataHandler,
  FormatsHandler,
  BackendsHandler,
} from "~/handlers";
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
  responseMapper
);

const server = new GrpcServer(
  metadataHandler,
  formatsHandler,
  backendsHandler,
  downloadHandler
);

server
  .start(HOST, PORT)
  .then(() => console.log(`gRPC server listening on ${HOST}:${PORT}`))
  .catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
