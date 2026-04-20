import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { basename, resolve, sep } from "node:path";
import type { Logger } from "~/logger";

import { AuthResult, authorize } from "./auth";
import { attachmentFor } from "./contentDisposition";
import { mimeFromExtension } from "./mimeTypes";
import { PATH_INTERNAL_FILES_PREFIX, PATH_INTERNAL_HEALTH } from "./protocol";
import { allowInternalFileRequest } from "./rateLimiter";
import {
  envelopeDegraded,
  envelopeError,
  envelopeOk,
  sendJson,
} from "./responses";

export interface InternalHttpServerOptions {
  host: string;
  port: number;
  downloadDir: string;
  internalApiKey: string;
}

export class InternalHttpServer {
  private readonly host: string;
  private readonly port: number;
  private readonly downloadDir: string;
  private readonly internalApiKey: string;
  private readonly logger: Logger;
  private readonly server: Server;

  constructor(options: InternalHttpServerOptions, logger: Logger) {
    this.host = options.host;
    this.port = options.port;
    this.downloadDir = resolve(options.downloadDir);
    this.internalApiKey = options.internalApiKey;
    this.logger = logger;
    this.server = createServer((req, res) => {
      void this.requestHandler(req, res);
    });
  }

  async start(): Promise<void> {
    await new Promise<void>((resolveStart, rejectStart) => {
      this.server.once("error", rejectStart);
      this.server.listen(this.port, this.host, () => {
        this.server.off("error", rejectStart);
        resolveStart();
      });
    });
  }

  get listeningPort(): number {
    const addressInfo = this.server.address();
    if (!addressInfo || typeof addressInfo === "string") {
      return this.port;
    }
    return addressInfo.port;
  }

  async stop(): Promise<void> {
    if (!this.server.listening) {
      return;
    }
    await new Promise<void>((resolveStop, rejectStop) => {
      this.server.close((err) => {
        if (err) {
          rejectStop(err);
          return;
        }
        resolveStop();
      });
    });
  }

  private async requestHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const requestUrl = req.url ?? "/";
    const method = req.method ?? "GET";
    const started = Date.now();

    const authResult = authorize(req, this.internalApiKey);
    if (authResult !== AuthResult.Authorized) {
      const statusCode = authResult === AuthResult.Missing ? 401 : 403;
      this.logger.info(
        {
          path: requestUrl,
          method,
          auth: authResult,
          status: statusCode,
          durationMs: Date.now() - started,
        },
        "internal_http_request",
      );
      sendJson(
        res,
        statusCode,
        envelopeError("UNAUTHORIZED", "Invalid internal API key"),
      );
      return;
    }

    if (method === "GET" && requestUrl === PATH_INTERNAL_HEALTH) {
      await this.handleHealth(res, requestUrl, method, started);
      return;
    }

    if (method === "GET" && requestUrl.startsWith(PATH_INTERNAL_FILES_PREFIX)) {
      if (!allowInternalFileRequest(req)) {
        this.logger.info(
          { path: requestUrl, method, status: 429, durationMs: Date.now() - started },
          "internal_http_request",
        );
        sendJson(
          res,
          429,
          envelopeError("RATE_LIMIT_EXCEEDED", "Too many requests"),
        );
        return;
      }
      await this.handleFile(requestUrl, res, method, started);
      return;
    }

    this.logger.info(
      { path: requestUrl, method, status: 404, durationMs: Date.now() - started },
      "internal_http_request",
    );
    sendJson(res, 404, envelopeError("NOT_FOUND", "Route not found"));
  }

  private async handleHealth(
    res: ServerResponse,
    requestUrl: string,
    method: string,
    started: number,
  ): Promise<void> {
    try {
      await access(this.downloadDir);
      sendJson(res, 200, envelopeOk({ downloads_dir: "ready" }));
      this.logger.info(
        {
          path: requestUrl,
          method,
          status: 200,
          downloadsDir: "ready",
          durationMs: Date.now() - started,
        },
        "internal_http_request",
      );
    } catch (err) {
      this.logger.error(
        { err, downloadDir: this.downloadDir },
        "Downloads directory is not accessible",
      );
      sendJson(res, 503, envelopeDegraded({ downloads_dir: "unavailable" }));
      this.logger.info(
        {
          path: requestUrl,
          method,
          status: 503,
          downloadsDir: "unavailable",
          durationMs: Date.now() - started,
        },
        "internal_http_request",
      );
    }
  }

  private async handleFile(
    requestUrl: string,
    res: ServerResponse,
    method: string,
    started: number,
  ): Promise<void> {
    const encodedFilename = requestUrl.slice(PATH_INTERNAL_FILES_PREFIX.length);
    let filename = "";

    try {
      filename = decodeURIComponent(encodedFilename);
    } catch {
      sendJson(
        res,
        400,
        envelopeError("INVALID_FILENAME", "Invalid filename encoding"),
      );
      return;
    }

    if (filename.includes("\0")) {
      sendJson(res, 400, envelopeError("INVALID_FILENAME", "Invalid filename"));
      return;
    }

    if (!this.isValidFilename(filename)) {
      sendJson(res, 400, envelopeError("INVALID_FILENAME", "Invalid filename"));
      return;
    }

    const fullPath = resolve(this.downloadDir, filename);
    const downloadDirPrefix = `${this.downloadDir}${sep}`;
    if (fullPath !== this.downloadDir && !fullPath.startsWith(downloadDirPrefix)) {
      sendJson(res, 400, envelopeError("INVALID_FILENAME", "Invalid filename"));
      return;
    }

    let fileStats;
    try {
      fileStats = await stat(fullPath);
    } catch {
      sendJson(res, 404, envelopeError("FILE_NOT_FOUND", "File not found"));
      this.logger.info(
        {
          path: requestUrl,
          method,
          filename,
          status: 404,
          durationMs: Date.now() - started,
        },
        "internal_http_request",
      );
      return;
    }

    const disposition = attachmentFor(filename);
    res.statusCode = 200;
    res.setHeader("Content-Type", mimeFromExtension(filename));
    res.setHeader("Content-Length", fileStats.size);
    res.setHeader("Content-Disposition", disposition);
    res.setHeader("X-Content-Type-Options", "nosniff");

    const stream = createReadStream(fullPath);
    stream.on("error", (err) => {
      this.logger.error({ err, filename }, "Failed to stream internal file");
      if (!res.headersSent) {
        sendJson(
          res,
          500,
          envelopeError("STREAM_ERROR", "Failed to stream file"),
        );
        return;
      }
      res.destroy(err);
    });
    res.on("finish", () => {
      this.logger.info(
        {
          path: requestUrl,
          method,
          filename,
          status: 200,
          bytes: fileStats.size,
          durationMs: Date.now() - started,
        },
        "internal_http_request",
      );
    });
    stream.pipe(res);
  }

  /** Belt-and-braces: basename check after separator and `..` rejection. */
  private isValidFilename(filename: string): boolean {
    if (!filename || filename.length > 255) {
      return false;
    }
    if (filename.startsWith(".")) {
      return false;
    }
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return false;
    }
    return basename(filename) === filename;
  }
}
