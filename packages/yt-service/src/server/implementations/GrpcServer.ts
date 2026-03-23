import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type handleServerStreamingCall,
  type handleUnaryCall,
  Server,
  ServerCredentials,
  type ServerUnaryCall,
  type ServerWritableStream,
  type sendUnaryData,
} from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import type {
  BackendsHandler,
  DownloadHandler,
  FormatsHandler,
  MetadataHandler,
} from "~/handlers";
import { ServerError } from "../errors/ServerError";
import type { IGrpcServer } from "../types/IGrpcServer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROTO_PATH = resolve(__dirname, "../../../proto/yt_service.proto");

export class GrpcServer implements IGrpcServer {
  private server: Server;

  constructor(
    private metadataHandler: MetadataHandler,
    private formatsHandler: FormatsHandler,
    private backendsHandler: BackendsHandler,
    private downloadHandler: DownloadHandler,
  ) {
    this.server = new Server();
  }

  async start(host: string, port: number): Promise<void> {
    const packageDefinition = await protoLoader.load(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const grpc = await import("@grpc/grpc-js");
    const proto = grpc.loadPackageDefinition(packageDefinition) as any;
    const service = proto.yt_service.YtService.service;

    this.server.addService(service, {
      GetMetadata: this.createGetMetadata(),
      ListFormats: this.createListFormats(),
      ListBackends: this.createListBackends(),
      Download: this.createDownload(),
    });

    return new Promise((resolvePromise, reject) => {
      this.server.bindAsync(
        `${host}:${port}`,
        ServerCredentials.createInsecure(),
        (err) => {
          if (err) {
            reject(new ServerError(err.message, host, port));
            return;
          }
          resolvePromise();
        },
      );
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolvePromise) => {
      this.server.tryShutdown(() => resolvePromise());
    });
  }

  private createGetMetadata(): handleUnaryCall<any, any> {
    return async (
      call: ServerUnaryCall<any, any>,
      callback: sendUnaryData<any>,
    ) => {
      try {
        const result = await this.metadataHandler.handle(call.request);
        callback(null, result);
      } catch (err) {
        callback(err as Error);
      }
    };
  }

  private createListFormats(): handleUnaryCall<any, any> {
    return async (
      _call: ServerUnaryCall<any, any>,
      callback: sendUnaryData<any>,
    ) => {
      try {
        const result = await this.formatsHandler.handle();
        callback(null, result);
      } catch (err) {
        callback(err as Error);
      }
    };
  }

  private createListBackends(): handleUnaryCall<any, any> {
    return async (
      _call: ServerUnaryCall<any, any>,
      callback: sendUnaryData<any>,
    ) => {
      try {
        const result = await this.backendsHandler.handle();
        callback(null, result);
      } catch (err) {
        callback(err as Error);
      }
    };
  }

  private createDownload(): handleServerStreamingCall<any, any> {
    return async (call: ServerWritableStream<any, any>) => {
      await this.downloadHandler.handle(call.request, (msg) => call.write(msg));
      call.end();
    };
  }
}
