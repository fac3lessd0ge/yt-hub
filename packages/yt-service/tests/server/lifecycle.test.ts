import { afterEach, describe, expect, it } from "vitest";
import type { DownloadService, ProgressCallback } from "yt-downloader";
import {
  BackendsHandler,
  DownloadHandler,
  FormatsHandler,
  MetadataHandler,
} from "~/handlers";
import { ErrorMapper, ResponseMapper } from "~/mapping";
import { GrpcServer } from "~/server";

function fakeDownloadService(): DownloadService {
  return {
    getMetadata: async () => ({
      title: "Lifecycle Video",
      authorName: "Lifecycle Author",
    }),
    listFormats: () => [{ id: "mp3", label: "MP3 audio" }],
    listBackends: () => ["yt-dlp"],
    download: async (_params: any, onProgress?: ProgressCallback) => {
      if (onProgress) {
        onProgress({ percent: 100, speed: "1.00MiB/s", eta: "00:00" });
      }
      return {
        outputPath: "/tmp/lifecycle.mp3",
        metadata: { title: "Lifecycle Video", authorName: "Lifecycle Author" },
        format: { id: "mp3", label: "MP3 audio" },
      };
    },
  } as unknown as DownloadService;
}

function createServer(): GrpcServer {
  const service = fakeDownloadService();
  const errorMapper = new ErrorMapper();
  const responseMapper = new ResponseMapper();

  return new GrpcServer(
    new MetadataHandler(service, responseMapper),
    new FormatsHandler(service, responseMapper),
    new BackendsHandler(service),
    new DownloadHandler(service, errorMapper, responseMapper),
  );
}

const serversToCleanup: GrpcServer[] = [];

afterEach(async () => {
  for (const s of serversToCleanup) {
    try {
      await s.stop();
    } catch {
      // ignore cleanup errors
    }
  }
  serversToCleanup.length = 0;
});

describe("GrpcServer lifecycle", () => {
  it("starts and binds to a port successfully", async () => {
    const server = createServer();
    serversToCleanup.push(server);

    await expect(server.start("127.0.0.1", 0)).resolves.toBeUndefined();
    expect(server.port).toBeGreaterThan(0);
  });

  it("isShuttingDown is false after start", async () => {
    const server = createServer();
    serversToCleanup.push(server);

    await server.start("127.0.0.1", 0);
    expect(server.isShuttingDown).toBe(false);
  });

  it("isShuttingDown transitions to true after stop is called", async () => {
    const server = createServer();
    await server.start("127.0.0.1", 0);

    expect(server.isShuttingDown).toBe(false);

    const stopPromise = server.stop();
    expect(server.isShuttingDown).toBe(true);
    await stopPromise;
    expect(server.isShuttingDown).toBe(true);
  });

  it("stop resolves when there are no active streams", async () => {
    const server = createServer();
    await server.start("127.0.0.1", 0);

    await expect(server.stop()).resolves.toBeUndefined();
  });

  it("rejects when binding to a port already in use", async () => {
    const server1 = createServer();
    serversToCleanup.push(server1);
    await server1.start("127.0.0.1", 0);
    const usedPort = server1.port;

    const server2 = createServer();
    serversToCleanup.push(server2);

    await expect(server2.start("127.0.0.1", usedPort)).rejects.toThrow();
  });
});
