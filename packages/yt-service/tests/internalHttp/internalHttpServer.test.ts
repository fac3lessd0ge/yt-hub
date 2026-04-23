import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { InternalHttpServer } from "~/internalHttp";
import { createLogger } from "~/logger";

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
  it("local file delivery: health works without api key; files are not served", async () => {
    const dir = await mkdtemp(join(tmpdir(), "yt-service-internal-http-"));
    const server = new InternalHttpServer(
      {
        host: "127.0.0.1",
        port: 0,
        downloadDir: dir,
        fileDeliveryMode: "local",
        internalApiKey: "",
      },
      createLogger("silent"),
    );
    servers.push(server);
    await server.start();

    const healthUrl = `http://127.0.0.1:${server.listeningPort}/internal/health`;
    const healthResp = await fetch(healthUrl);
    expect(healthResp.status).toBe(200);

    await writeFile(join(dir, "local-mode.mp3"), "x");
    const fileUrl = `http://127.0.0.1:${server.listeningPort}/internal/files/local-mode.mp3`;
    const fileResp = await fetch(fileUrl);
    expect(fileResp.status).toBe(404);
    const j = (await fileResp.json()) as Record<string, unknown>;
    expect(j.code).toBe("NOT_AVAILABLE");
  });

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
    expect((j.data as Record<string, string>).downloads_dir).toBe(
      "unavailable",
    );
  });

  function makeSpyLogger(): {
    logger: ReturnType<typeof createLogger>;
    calls: Array<{ obj: unknown; msg: string }>;
  } {
    const calls: Array<{ obj: unknown; msg: string }> = [];
    const base = createLogger("silent");
    const logger = Object.assign(Object.create(base) as typeof base, {
      info: (obj: unknown, msg: string) => {
        calls.push({ obj, msg });
      },
    });
    return { logger, calls };
  }

  it("logs an internal_http_server_started event with mode and route flag on start()", async () => {
    const dir = await mkdtemp(join(tmpdir(), "yt-service-internal-http-"));
    const { logger, calls } = makeSpyLogger();

    const server = new InternalHttpServer(
      {
        host: "127.0.0.1",
        port: 0,
        downloadDir: dir,
        fileDeliveryMode: "local",
        internalApiKey: "",
      },
      logger,
    );
    servers.push(server);
    await server.start();

    const startedCalls = calls.filter(
      (c) => c.msg === "internal_http_server_started",
    );
    expect(startedCalls).toHaveLength(1);
    expect(startedCalls[0].obj).toMatchObject({
      fileDeliveryMode: "local",
      internalFilesRouteEnabled: false,
      host: "127.0.0.1",
      port: expect.any(Number),
    });
  });

  it("reports internalFilesRouteEnabled=true in remote mode", async () => {
    const dir = await mkdtemp(join(tmpdir(), "yt-service-internal-http-"));
    const { logger, calls } = makeSpyLogger();

    const server = new InternalHttpServer(
      {
        host: "127.0.0.1",
        port: 0,
        downloadDir: dir,
        fileDeliveryMode: "remote",
        internalApiKey: KEY,
      },
      logger,
    );
    servers.push(server);
    await server.start();

    const startedCalls = calls.filter(
      (c) => c.msg === "internal_http_server_started",
    );
    expect(startedCalls).toHaveLength(1);
    expect(startedCalls[0].obj).toMatchObject({
      fileDeliveryMode: "remote",
      internalFilesRouteEnabled: true,
      host: "127.0.0.1",
    });
  });
});
