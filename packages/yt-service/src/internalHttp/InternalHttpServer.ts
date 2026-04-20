import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { basename, extname, resolve, sep } from "node:path";
import type { Logger } from "~/logger";

interface InternalHttpServerOptions {
  host: string;
  port: number;
  downloadDir: string;
  internalApiKey?: string;
}

type AuthResult = "authorized" | "missing" | "invalid";

export class InternalHttpServer {
  private readonly host: string;
  private readonly port: number;
  private readonly downloadDir: string;
  private readonly internalApiKey?: string;
  private readonly logger: Logger;
  private readonly server = createServer(this.requestHandler.bind(this));

  constructor(options: InternalHttpServerOptions, logger: Logger) {
    this.host = options.host;
    this.port = options.port;
    this.downloadDir = resolve(options.downloadDir);
    this.internalApiKey = options.internalApiKey;
    this.logger = logger;
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

    const authResult = this.authorize(req);
    if (authResult !== "authorized") {
      const statusCode = authResult === "missing" ? 401 : 403;
      this.respondJson(res, statusCode, {
        code: "UNAUTHORIZED",
        message: "Invalid internal API key",
      });
      return;
    }

    if (method === "GET" && requestUrl === "/internal/health") {
      await this.handleHealth(res);
      return;
    }

    if (method === "GET" && requestUrl.startsWith("/internal/files/")) {
      await this.handleFile(requestUrl, res);
      return;
    }

    this.respondJson(res, 404, { code: "NOT_FOUND", message: "Route not found" });
  }

  private authorize(req: IncomingMessage): AuthResult {
    if (!this.internalApiKey) {
      return "invalid";
    }

    const incomingHeader = req.headers["x-internal-api-key"];
    const incomingKey = Array.isArray(incomingHeader) ? incomingHeader[0] : incomingHeader;
    if (!incomingKey) {
      return "missing";
    }

    const expected = Buffer.from(this.internalApiKey);
    const received = Buffer.from(incomingKey);
    if (expected.length !== received.length) {
      return "invalid";
    }

    return timingSafeEqual(expected, received) ? "authorized" : "invalid";
  }

  private async handleHealth(res: ServerResponse): Promise<void> {
    try {
      await access(this.downloadDir);
      this.respondJson(res, 200, { status: "ok", downloads_dir: "ready" });
    } catch (err) {
      this.logger.error({ err, downloadDir: this.downloadDir }, "Downloads directory is not accessible");
      this.respondJson(res, 503, { status: "degraded", downloads_dir: "unavailable" });
    }
  }

  private async handleFile(requestUrl: string, res: ServerResponse): Promise<void> {
    const encodedFilename = requestUrl.slice("/internal/files/".length);
    let filename = "";

    try {
      filename = decodeURIComponent(encodedFilename);
    } catch {
      this.respondJson(res, 400, { code: "INVALID_FILENAME", message: "Invalid filename encoding" });
      return;
    }

    if (!this.isValidFilename(filename)) {
      this.respondJson(res, 400, { code: "INVALID_FILENAME", message: "Invalid filename" });
      return;
    }

    const fullPath = resolve(this.downloadDir, filename);
    const downloadDirPrefix = `${this.downloadDir}${sep}`;
    if (fullPath !== this.downloadDir && !fullPath.startsWith(downloadDirPrefix)) {
      this.respondJson(res, 400, { code: "INVALID_FILENAME", message: "Invalid filename" });
      return;
    }

    let fileStats;
    try {
      fileStats = await stat(fullPath);
    } catch {
      this.respondJson(res, 404, { code: "FILE_NOT_FOUND", message: "File not found" });
      return;
    }

    const disposition = this.contentDispositionFor(filename);
    res.statusCode = 200;
    res.setHeader("Content-Type", this.mimeFromExtension(filename));
    res.setHeader("Content-Length", fileStats.size);
    res.setHeader("Content-Disposition", disposition);
    res.setHeader("X-Content-Type-Options", "nosniff");

    const stream = createReadStream(fullPath);
    stream.on("error", (err) => {
      this.logger.error({ err, filename }, "Failed to stream internal file");
      if (!res.headersSent) {
        this.respondJson(res, 500, { code: "STREAM_ERROR", message: "Failed to stream file" });
        return;
      }
      res.destroy(err);
    });
    stream.pipe(res);
  }

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

  private respondJson(res: ServerResponse, statusCode: number, body: object): void {
    if (res.headersSent) {
      return;
    }
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
  }

  private mimeFromExtension(filename: string): string {
    switch (extname(filename).toLowerCase()) {
      case ".mp3":
        return "audio/mpeg";
      case ".mp4":
        return "video/mp4";
      case ".webm":
        return "video/webm";
      case ".m4a":
        return "audio/mp4";
      case ".ogg":
      case ".oga":
        return "audio/ogg";
      case ".wav":
        return "audio/wav";
      case ".flac":
        return "audio/flac";
      case ".mkv":
        return "video/x-matroska";
      default:
        return "application/octet-stream";
    }
  }

  private contentDispositionFor(filename: string): string {
    const asciiName = filename
      .split("")
      .map((char) => (char.charCodeAt(0) < 128 ? char : "_"))
      .join("");
    const encoded = encodeURIComponent(filename).replace(/%20/g, "%20");
    return `attachment; filename="${asciiName}"; filename*=UTF-8''${encoded}`;
  }
}
