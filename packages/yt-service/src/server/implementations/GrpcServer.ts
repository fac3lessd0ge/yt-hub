import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  status as GrpcStatus,
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
import { RequestValidator } from "~/handlers/requestValidator";
import { ErrorMapper } from "~/mapping";
import { ServerError } from "../errors/ServerError";
import type { IGrpcServer } from "../types/IGrpcServer";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROTO_PATH = resolve(__dirname, "../../../proto/yt_service.proto");

const SHUTDOWN_TIMEOUT_MS = 8000;

export interface GrpcServerOptions {
  maxMessageSize?: number;
}

export class GrpcServer implements IGrpcServer {
  private server: Server;
  private _shuttingDown: boolean = false;
  private _activeStreams: Set<ServerWritableStream<any, any>> = new Set();
  private requestValidator: RequestValidator;
  private errorMapper: ErrorMapper;

  constructor(
    private metadataHandler: MetadataHandler,
    private formatsHandler: FormatsHandler,
    private backendsHandler: BackendsHandler,
    private downloadHandler: DownloadHandler,
    options: GrpcServerOptions = {},
  ) {
    this.requestValidator = new RequestValidator();
    this.errorMapper = new ErrorMapper();
    const serverOptions: Record<string, unknown> = {};
    if (options.maxMessageSize !== undefined) {
      serverOptions["grpc.max_receive_message_length"] = options.maxMessageSize;
      serverOptions["grpc.max_send_message_length"] = options.maxMessageSize;
    }
    this.server = new Server(serverOptions);
  }

  get isShuttingDown(): boolean {
    return this._shuttingDown;
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
    this._shuttingDown = true;
    console.log(
      `Waiting for ${this._activeStreams.size} active stream(s) to finish...`,
    );

    await Promise.race([
      this.waitForActiveStreams(),
      new Promise<void>((resolve) => setTimeout(resolve, SHUTDOWN_TIMEOUT_MS)),
    ]);

    if (this._activeStreams.size > 0) {
      console.warn(
        `Shutdown timeout reached with ${this._activeStreams.size} active stream(s) remaining`,
      );
    }

    return new Promise((resolvePromise) => {
      this.server.tryShutdown(() => resolvePromise());
    });
  }

  private rejectIfShuttingDown(callback: sendUnaryData<any>): boolean {
    if (this._shuttingDown) {
      callback({
        code: GrpcStatus.UNAVAILABLE,
        message: "Server is shutting down",
      });
      return true;
    }
    return false;
  }

  private waitForActiveStreams(): Promise<void> {
    if (this._activeStreams.size === 0) return Promise.resolve();
    return new Promise((resolve) => {
      const check = () => {
        if (this._activeStreams.size === 0) resolve();
      };
      // Store the checker so we can call it when streams complete
      this._onStreamComplete = check;
    });
  }

  private _onStreamComplete: (() => void) | null = null;

  private createGetMetadata(): handleUnaryCall<any, any> {
    return async (
      call: ServerUnaryCall<any, any>,
      callback: sendUnaryData<any>,
    ) => {
      if (this.rejectIfShuttingDown(callback)) return;
      try {
        this.requestValidator.validateMetadataRequest(call.request);
        const result = await this.metadataHandler.handle(call.request);
        callback(null, result);
      } catch (err) {
        const mapped = this.errorMapper.mapError(err);
        callback({
          code: mapped.grpcStatus,
          message: JSON.stringify({
            code: mapped.code,
            message: mapped.message,
            retryable: mapped.retryable,
          }),
        });
      }
    };
  }

  private createListFormats(): handleUnaryCall<any, any> {
    return async (
      _call: ServerUnaryCall<any, any>,
      callback: sendUnaryData<any>,
    ) => {
      if (this.rejectIfShuttingDown(callback)) return;
      try {
        const result = await this.formatsHandler.handle();
        callback(null, result);
      } catch (err) {
        const mapped = this.errorMapper.mapError(err);
        callback({
          code: mapped.grpcStatus,
          message: JSON.stringify({
            code: mapped.code,
            message: mapped.message,
            retryable: mapped.retryable,
          }),
        });
      }
    };
  }

  private createListBackends(): handleUnaryCall<any, any> {
    return async (
      _call: ServerUnaryCall<any, any>,
      callback: sendUnaryData<any>,
    ) => {
      if (this.rejectIfShuttingDown(callback)) return;
      try {
        const result = await this.backendsHandler.handle();
        callback(null, result);
      } catch (err) {
        const mapped = this.errorMapper.mapError(err);
        callback({
          code: mapped.grpcStatus,
          message: JSON.stringify({
            code: mapped.code,
            message: mapped.message,
            retryable: mapped.retryable,
          }),
        });
      }
    };
  }

  private createDownload(): handleServerStreamingCall<any, any> {
    return async (call: ServerWritableStream<any, any>) => {
      if (this._shuttingDown) {
        const err = Object.assign(new Error("Server is shutting down"), {
          code: GrpcStatus.UNAVAILABLE,
        });
        call.destroy(err);
        return;
      }

      this._activeStreams.add(call);
      try {
        this.requestValidator.validateDownloadRequest(call.request);
        await this.downloadHandler.handle(call.request, (msg) =>
          call.write(msg),
        );
        call.end();
      } finally {
        this._activeStreams.delete(call);
        this._onStreamComplete?.();
      }
    };
  }
}
