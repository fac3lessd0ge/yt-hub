import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createLogger } from "~/logger";
import { InternalHttpServer } from "~/internalHttp";

const servers: InternalHttpServer[] = [];

afterEach(async () => {
  while (servers.length > 0) {
    const server = servers.pop();
    if (server) {
      await server.stop();
    }
  }
});

describe("InternalHttpServer", () => {
  it("requires internal api key", async () => {
    const dir = await mkdtemp(join(tmpdir(), "yt-service-internal-http-"));
    const server = new InternalHttpServer(
      {
        host: "127.0.0.1",
        port: 0,
        downloadDir: dir,
        internalApiKey: "top-secret",
      },
      createLogger("silent"),
    );
    servers.push(server);
    await server.start();

    const url = `http://127.0.0.1:${server.listeningPort}/internal/health`;
    const respMissing = await fetch(url);
    expect(respMissing.status).toBe(401);

    const respInvalid = await fetch(url, {
      headers: { "x-internal-api-key": "wrong" },
    });
    expect(respInvalid.status).toBe(403);
  });

  it("returns 404 for missing file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "yt-service-internal-http-"));
    const server = new InternalHttpServer(
      {
        host: "127.0.0.1",
        port: 0,
        downloadDir: dir,
        internalApiKey: "top-secret",
      },
      createLogger("silent"),
    );
    servers.push(server);
    await server.start();

    const url = `http://127.0.0.1:${server.listeningPort}/internal/files/not-found.mp3`;
    const resp = await fetch(url, {
      headers: { "x-internal-api-key": "top-secret" },
    });
    expect(resp.status).toBe(404);
  });

  it("streams existing file with attachment headers", async () => {
    const dir = await mkdtemp(join(tmpdir(), "yt-service-internal-http-"));
    const filename = "sample.mp3";
    await writeFile(join(dir, filename), "audio-bytes");

    const server = new InternalHttpServer(
      {
        host: "127.0.0.1",
        port: 0,
        downloadDir: dir,
        internalApiKey: "top-secret",
      },
      createLogger("silent"),
    );
    servers.push(server);
    await server.start();

    const url = `http://127.0.0.1:${server.listeningPort}/internal/files/${filename}`;
    const resp = await fetch(url, {
      headers: { "x-internal-api-key": "top-secret" },
    });

    expect(resp.status).toBe(200);
    expect(resp.headers.get("content-type")).toBe("audio/mpeg");
    expect(resp.headers.get("content-disposition")).toContain("attachment");
    expect(await resp.text()).toBe("audio-bytes");
  });
});
