import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createLogger } from "~/logger";
import { InternalHttpServer } from "~/internalHttp";

/** Must be >= 16 chars (loadConfig requirement). */
const KEY = "sixteencharslong";

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
        internalApiKey: KEY,
      },
      createLogger("silent"),
    );
    servers.push(server);
    await server.start();

    const url = `http://127.0.0.1:${server.listeningPort}/internal/health`;
    const respMissing = await fetch(url);
    expect(respMissing.status).toBe(401);
    const j1 = (await respMissing.json()) as Record<string, unknown>;
    expect(j1.status).toBe("error");
    expect(j1.code).toBe("UNAUTHORIZED");

    const respInvalid = await fetch(url, {
      headers: { "x-internal-api-key": "wrongwrongwrong" },
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
        internalApiKey: KEY,
      },
      createLogger("silent"),
    );
    servers.push(server);
    await server.start();

    const url = `http://127.0.0.1:${server.listeningPort}/internal/files/not-found.mp3`;
    const resp = await fetch(url, {
      headers: { "x-internal-api-key": KEY },
    });
    expect(resp.status).toBe(404);
    const j = (await resp.json()) as Record<string, unknown>;
    expect(j.status).toBe("error");
    expect(j.code).toBe("FILE_NOT_FOUND");
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
        internalApiKey: KEY,
      },
      createLogger("silent"),
    );
    servers.push(server);
    await server.start();

    const url = `http://127.0.0.1:${server.listeningPort}/internal/files/${filename}`;
    const resp = await fetch(url, {
      headers: { "x-internal-api-key": KEY },
    });

    expect(resp.status).toBe(200);
    expect(resp.headers.get("content-type")).toBe("audio/mpeg");
    expect(resp.headers.get("content-disposition")).toContain("attachment");
    expect(await resp.text()).toBe("audio-bytes");
  });

  it("rejects path traversal ..%2F", async () => {
    const dir = await mkdtemp(join(tmpdir(), "yt-service-internal-http-"));
    const server = new InternalHttpServer(
      {
        host: "127.0.0.1",
        port: 0,
        downloadDir: dir,
        internalApiKey: KEY,
      },
      createLogger("silent"),
    );
    servers.push(server);
    await server.start();

    const url = `http://127.0.0.1:${server.listeningPort}/internal/files/..%2Fsecret`;
    const resp = await fetch(url, { headers: { "x-internal-api-key": KEY } });
    expect(resp.status).toBe(400);
  });

  it("rejects backslash traversal segment", async () => {
    const dir = await mkdtemp(join(tmpdir(), "yt-service-internal-http-"));
    const server = new InternalHttpServer(
      {
        host: "127.0.0.1",
        port: 0,
        downloadDir: dir,
        internalApiKey: KEY,
      },
      createLogger("silent"),
    );
    servers.push(server);
    await server.start();

    const url = `http://127.0.0.1:${server.listeningPort}/internal/files/..%5Cx`;
    const resp = await fetch(url, { headers: { "x-internal-api-key": KEY } });
    expect(resp.status).toBe(400);
  });

  it("rejects null byte in filename", async () => {
    const dir = await mkdtemp(join(tmpdir(), "yt-service-internal-http-"));
    const server = new InternalHttpServer(
      {
        host: "127.0.0.1",
        port: 0,
        downloadDir: dir,
        internalApiKey: KEY,
      },
      createLogger("silent"),
    );
    servers.push(server);
    await server.start();

    const url = `http://127.0.0.1:${server.listeningPort}/internal/files/a%00b.mp3`;
    const resp = await fetch(url, { headers: { "x-internal-api-key": KEY } });
    expect(resp.status).toBe(400);
  });

  it("rejects leading dot filename", async () => {
    const dir = await mkdtemp(join(tmpdir(), "yt-service-internal-http-"));
    await writeFile(join(dir, ".env"), "x");
    const server = new InternalHttpServer(
      {
        host: "127.0.0.1",
        port: 0,
        downloadDir: dir,
        internalApiKey: KEY,
      },
      createLogger("silent"),
    );
    servers.push(server);
    await server.start();

    const url = `http://127.0.0.1:${server.listeningPort}/internal/files/.env`;
    const resp = await fetch(url, { headers: { "x-internal-api-key": KEY } });
    expect(resp.status).toBe(400);
  });

  it("rejects oversized filename", async () => {
    const dir = await mkdtemp(join(tmpdir(), "yt-service-internal-http-"));
    const server = new InternalHttpServer(
      {
        host: "127.0.0.1",
        port: 0,
        downloadDir: dir,
        internalApiKey: KEY,
      },
      createLogger("silent"),
    );
    servers.push(server);
    await server.start();

    const longName = `${"a".repeat(256)}.mp3`;
    const url = `http://127.0.0.1:${server.listeningPort}/internal/files/${encodeURIComponent(longName)}`;
    const resp = await fetch(url, { headers: { "x-internal-api-key": KEY } });
    expect(resp.status).toBe(400);
  });

  it("rejects malformed percent-encoding", async () => {
    const dir = await mkdtemp(join(tmpdir(), "yt-service-internal-http-"));
    const server = new InternalHttpServer(
      {
        host: "127.0.0.1",
        port: 0,
        downloadDir: dir,
        internalApiKey: KEY,
      },
      createLogger("silent"),
    );
    servers.push(server);
    await server.start();

    const url = `http://127.0.0.1:${server.listeningPort}/internal/files/bad%ZZ.mp3`;
    const resp = await fetch(url, { headers: { "x-internal-api-key": KEY } });
    expect(resp.status).toBe(400);
    const j = (await resp.json()) as Record<string, unknown>;
    expect(j.code).toBe("INVALID_FILENAME");
  });

  it("returns 404 for wrong HTTP method on health", async () => {
    const dir = await mkdtemp(join(tmpdir(), "yt-service-internal-http-"));
    const server = new InternalHttpServer(
      {
        host: "127.0.0.1",
        port: 0,
        downloadDir: dir,
        internalApiKey: KEY,
      },
      createLogger("silent"),
    );
    servers.push(server);
    await server.start();

    const url = `http://127.0.0.1:${server.listeningPort}/internal/health`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "x-internal-api-key": KEY },
    });
    expect(resp.status).toBe(404);
  });

  it("/internal/health returns ok when download dir exists", async () => {
    const dir = await mkdtemp(join(tmpdir(), "yt-service-internal-http-"));
    const server = new InternalHttpServer(
      {
        host: "127.0.0.1",
        port: 0,
        downloadDir: dir,
        internalApiKey: KEY,
      },
      createLogger("silent"),
    );
    servers.push(server);
    await server.start();

    const url = `http://127.0.0.1:${server.listeningPort}/internal/health`;
    const resp = await fetch(url, { headers: { "x-internal-api-key": KEY } });
    expect(resp.status).toBe(200);
    const j = (await resp.json()) as Record<string, unknown>;
    expect(j.status).toBe("ok");
    expect((j.data as Record<string, string>).downloads_dir).toBe("ready");
  });

  it("/internal/health returns degraded when download dir missing", async () => {
    const server = new InternalHttpServer(
      {
        host: "127.0.0.1",
        port: 0,
        downloadDir: join(tmpdir(), "nonexistent-yt-internal-health-dir"),
        internalApiKey: KEY,
      },
      createLogger("silent"),
    );
    servers.push(server);
    await server.start();

    const url = `http://127.0.0.1:${server.listeningPort}/internal/health`;
    const resp = await fetch(url, { headers: { "x-internal-api-key": KEY } });
    expect(resp.status).toBe(503);
    const j = (await resp.json()) as Record<string, unknown>;
    expect(j.status).toBe("degraded");
    expect((j.data as Record<string, string>).downloads_dir).toBe("unavailable");
  });
});
