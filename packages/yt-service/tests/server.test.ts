import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DownloadService, ProgressCallback } from "yt-downloader";
import {
  BackendsHandler,
  DownloadHandler,
  FormatsHandler,
  MetadataHandler,
} from "~/handlers";
import { ErrorMapper, ResponseMapper } from "~/mapping";
import { GrpcServer } from "~/server";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROTO_PATH = resolve(__dirname, "../proto/yt_service.proto");

function fakeDownloadService(): DownloadService {
  return {
    getMetadata: async () => ({
      title: "Integration Video",
      authorName: "Integration Author",
    }),
    listFormats: () => [
      { id: "mp3", label: "MP3 audio" },
      { id: "mp4", label: "MP4 video" },
    ],
    listBackends: () => ["yt-dlp"],
    download: async (_params: any, onProgress?: ProgressCallback) => {
      if (onProgress) {
        onProgress({ percent: 50, speed: "1.00MiB/s", eta: "00:02" });
        onProgress({ percent: 100, speed: "1.00MiB/s", eta: "00:00" });
      }
      return {
        outputPath: "/tmp/integration.mp3",
        metadata: {
          title: "Integration Video",
          authorName: "Integration Author",
        },
        format: { id: "mp3", label: "MP3 audio" },
      };
    },
  } as unknown as DownloadService;
}

let server: GrpcServer;
let client: any;
let port: number;

beforeAll(async () => {
  const service = fakeDownloadService();
  const errorMapper = new ErrorMapper();
  const responseMapper = new ResponseMapper();

  server = new GrpcServer(
    new MetadataHandler(service, responseMapper),
    new FormatsHandler(service, responseMapper),
    new BackendsHandler(service),
    new DownloadHandler(service, errorMapper, responseMapper),
  );

  port = 0;
  await server.start("127.0.0.1", port);
  port = server.port;

  const packageDefinition = await protoLoader.load(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const proto = grpc.loadPackageDefinition(packageDefinition) as any;
  client = new proto.yt_hub.v1.YtService(
    `127.0.0.1:${port}`,
    grpc.credentials.createInsecure(),
  );
});

afterAll(async () => {
  client?.close();
  await server?.stop();
});

function unary<Req, Res>(method: string, request: Req): Promise<Res> {
  return new Promise((resolve, reject) => {
    client[method](request, (err: Error | null, response: Res) => {
      if (err) reject(err);
      else resolve(response);
    });
  });
}

function serverStream<Req>(method: string, request: Req): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const messages: any[] = [];
    const call = client[method](request);
    call.on("data", (msg: any) => messages.push(msg));
    call.on("end", () => resolve(messages));
    call.on("error", reject);
  });
}

describe("GrpcServer integration", () => {
  it("GetMetadata returns video metadata", async () => {
    const result = await unary("GetMetadata", {
      link: "https://www.youtube.com/watch?v=abc",
    });
    expect(result).toEqual({
      title: "Integration Video",
      author_name: "Integration Author",
    });
  });

  it("ListFormats returns available formats", async () => {
    const result: any = await unary("ListFormats", {});
    expect(result.formats).toHaveLength(2);
    expect(result.formats[0]).toEqual({ id: "mp3", label: "MP3 audio" });
    expect(result.formats[1]).toEqual({ id: "mp4", label: "MP4 video" });
  });

  it("ListBackends returns available backends", async () => {
    const result: any = await unary("ListBackends", {});
    expect(result.backends).toEqual(["yt-dlp"]);
  });

  it("Download streams progress and completion", async () => {
    const messages = await serverStream("Download", {
      link: "https://www.youtube.com/watch?v=abc",
      format: "mp3",
      name: "test",
    });

    expect(messages.length).toBeGreaterThanOrEqual(3);

    const progressMsgs = messages.filter((m) => m.payload === "progress");
    expect(progressMsgs).toHaveLength(2);
    expect(progressMsgs[0].progress.percent).toBe(50);
    expect(progressMsgs[1].progress.percent).toBe(100);

    const completeMsgs = messages.filter((m) => m.payload === "complete");
    expect(completeMsgs).toHaveLength(1);
    expect(completeMsgs[0].complete.output_path).toBe("/tmp/integration.mp3");
    expect(completeMsgs[0].complete.title).toBe("Integration Video");
  });
});
