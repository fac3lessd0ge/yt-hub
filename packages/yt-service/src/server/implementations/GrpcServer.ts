import { resolve } from "node:path";
import {
  status as GrpcStatus,
  type handleServerStreamingCall,
  type handleUnaryCall,
  type Metadata,
  Server,
  ServerCredentials,
  type ServerUnaryCall,
  type ServerWritableStream,
  type sendUnaryData,
} from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import type {
  GetMetadataRequest,
  GetMetadataResponse,
  ListBackendsRequest,
  ListBackendsResponse,
  ListFormatsRequest,
  ListFormatsResponse,
  DownloadRequest as ProtoDownloadRequest,
  DownloadResponse as ProtoDownloadResponse,
} from "~/generated/yt_service";
import type {
  BackendsHandler,
  DownloadHandler,
  FormatsHandler,
  MetadataHandler,
} from "~/handlers";
import { RequestValidator } from "~/handlers/requestValidator";
import type { Logger } from "~/logger";
import { ErrorMapper } from "~/mapping";
import { ServerError } from "../errors/ServerError";
import type { IGrpcServer } from "../types/IGrpcServer";

const PROTO_PATH = resolve(process.cwd(), "proto/yt_service.proto");

const SHUTDOWN_TIMEOUT_MS = 8000;

export interface GrpcServerOptions {
  maxMessageSize?: number;
}

export class GrpcServer implements IGrpcServer {
  private server: Server;
  private _shuttingDown: boolean = false;
  private _activeStreams: Set<
    ServerWritableStream<ProtoDownloadRequest, ProtoDownloadResponse>
  > = new Set();
  private _port: number = 0;
  private requestValidator: RequestValidator;
  private errorMapper: ErrorMapper;
  private logger: Logger;

  constructor(
    private metadataHandler: MetadataHandler,
    private formatsHandler: FormatsHandler,
    private backendsHandler: BackendsHandler,
    private downloadHandler: DownloadHandler,
    options: GrpcServerOptions = {},
    logger?: Logger,
  ) {
    this.requestValidator = new RequestValidator();
    this.errorMapper = new ErrorMapper();
    if (logger) {
      this.logger = logger;
    } else {
      // No-op logger for tests — child() returns itself
      const noop: any = {
        info: () => {},
        warn: () => {},
        error: () => {},
      };
      noop.child = () => noop;
      this.logger = noop as Logger;
    }
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

  get port(): number {
    return this._port;
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
    const proto = grpc.loadPackageDefinition(packageDefinition) as {
      yt_hub: { v1: { YtService: { service: any } } };
    };
    const service = proto.yt_hub.v1.YtService.service;

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
        (err, boundPort) => {
          if (err) {
            reject(new ServerError(err.message, host, port));
            return;
          }
          this._port = boundPort;
          resolvePromise();
        },
      );
    });
  }

  async stop(): Promise<void> {
    this._shuttingDown = true;
    this.logger.info(
      { activeStreams: this._activeStreams.size },
      "Waiting for active streams to finish",
    );

    await Promise.race([
      this.waitForActiveStreams(),
      new Promise<void>((resolve) => setTimeout(resolve, SHUTDOWN_TIMEOUT_MS)),
    ]);

    if (this._activeStreams.size > 0) {
      this.logger.warn(
        { activeStreams: this._activeStreams.size },
        "Shutdown timeout reached with active streams remaining",
      );
    }

    return new Promise((resolvePromise) => {
      this.server.tryShutdown(() => resolvePromise());
    });
  }

  private rejectIfShuttingDown<T>(callback: sendUnaryData<T>): boolean {
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

  private childLogger(metadata: Metadata, method: string): Logger {
    const values = metadata.get("x-request-id");
    const requestId = values.length > 0 ? String(values[0]) : undefined;
    return this.logger.child({ requestId, method });
  }

  private createGetMetadata(): handleUnaryCall<
    GetMetadataRequest,
    GetMetadataResponse
  > {
    return async (
      call: ServerUnaryCall<GetMetadataRequest, GetMetadataResponse>,
      callback: sendUnaryData<GetMetadataResponse>,
    ) => {
      if (this.rejectIfShuttingDown(callback)) return;
      const log = this.childLogger(call.metadata, "GetMetadata");
      log.info({ link: call.request.link }, "Handling GetMetadata request");
      try {
        this.requestValidator.validateMetadataRequest(call.request);
        const result = await this.metadataHandler.handle(call.request);
        log.info("GetMetadata completed successfully");
        callback(null, result);
      } catch (err) {
        const mapped = this.errorMapper.mapError(err);
        log.error({ code: mapped.code }, mapped.message);
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

  private createListFormats(): handleUnaryCall<
    ListFormatsRequest,
    ListFormatsResponse
  > {
    return async (
      call: ServerUnaryCall<ListFormatsRequest, ListFormatsResponse>,
      callback: sendUnaryData<ListFormatsResponse>,
    ) => {
      if (this.rejectIfShuttingDown(callback)) return;
      const log = this.childLogger(call.metadata, "ListFormats");
      log.info("Handling ListFormats request");
      try {
        const result = await this.formatsHandler.handle();
        log.info("ListFormats completed successfully");
        callback(null, result);
      } catch (err) {
        const mapped = this.errorMapper.mapError(err);
        log.error({ code: mapped.code }, mapped.message);
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

  private createListBackends(): handleUnaryCall<
    ListBackendsRequest,
    ListBackendsResponse
  > {
    return async (
      call: ServerUnaryCall<ListBackendsRequest, ListBackendsResponse>,
      callback: sendUnaryData<ListBackendsResponse>,
    ) => {
      if (this.rejectIfShuttingDown(callback)) return;
      const log = this.childLogger(call.metadata, "ListBackends");
      log.info("Handling ListBackends request");
      try {
        const result = await this.backendsHandler.handle();
        log.info("ListBackends completed successfully");
        callback(null, result);
      } catch (err) {
        const mapped = this.errorMapper.mapError(err);
        log.error({ code: mapped.code }, mapped.message);
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

  private createDownload(): handleServerStreamingCall<
    ProtoDownloadRequest,
    ProtoDownloadResponse
  > {
    return async (
      call: ServerWritableStream<ProtoDownloadRequest, ProtoDownloadResponse>,
    ) => {
      if (this._shuttingDown) {
        const err = Object.assign(new Error("Server is shutting down"), {
          code: GrpcStatus.UNAVAILABLE,
        });
        call.destroy(err);
        return;
      }

      const log = this.childLogger(call.metadata, "Download");
      log.info(
        { link: call.request.link, format: call.request.format },
        "Handling Download request",
      );

      this._activeStreams.add(call);
      const abortController = new AbortController();
      call.on("cancelled", () => {
        log.warn("Download stream cancelled by client");
        abortController.abort();
      });
      try {
        this.requestValidator.validateDownloadRequest(call.request);
        await this.downloadHandler.handle(
          call.request,
          (msg) => call.write(msg as unknown as ProtoDownloadResponse),
          abortController.signal,
        );
        log.info("Download completed successfully");
        call.end();
      } catch (err) {
        const mapped =
          err && typeof err === "object" && "grpcStatus" in err
            ? (err as { grpcStatus: number; code: string; message: string })
            : this.errorMapper.mapError(err);
        log.error({ err: mapped }, "Download failed");
        const grpcErr = Object.assign(new Error(mapped.message), {
          code: mapped.grpcStatus,
        });
        call.destroy(grpcErr);
      } finally {
        this._activeStreams.delete(call);
        this._onStreamComplete?.();
      }
    };
  }
}
