import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { DownloadService } from "../src";
import { BackendRegistry } from "~/download";
import { ValidationError } from "~/input";
import { HttpMetadataFetcher } from "~/metadata";
import type { IDownloadBackend } from "~/download";
import type { ProgressCallback } from "~/download";

const OEMBED_URL = "https://www.youtube.com/oembed";
const server = setupServer(
  http.get(OEMBED_URL, () =>
    HttpResponse.json({ title: "Test Video", author_name: "Test Channel" })
  )
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function fakeBackend(
  onDownload?: (onProgress?: ProgressCallback) => void
): IDownloadBackend {
  return {
    name: "fake",
    supportedFormats: () => [
      { id: "mp3", label: "MP3 audio" },
      { id: "mp4", label: "MP4 video" },
    ],
    requiredDependencies: () => [],
    download: async (_link, _path, _format, onProgress?) => {
      onDownload?.(onProgress);
    },
  };
}

function createService(overrides: { backend?: IDownloadBackend } = {}) {
  const backend = overrides.backend ?? fakeBackend();
  const backends = new BackendRegistry();
  backends.register(backend);

  return new DownloadService({
    backend: backend.name,
    binaryResolver: { resolve: () => "/usr/bin/mock" },
    metadataFetcher: new HttpMetadataFetcher(),
    backends,
  });
}

describe("DownloadService", () => {
  it("download returns result with metadata and outputPath", async () => {
    const service = createService();
    const result = await service.download({
      link: "https://www.youtube.com/watch?v=abc",
      format: "mp3",
      name: "test-song",
      destination: "/tmp/yt-test",
    });

    expect(result.metadata.title).toBe("Test Video");
    expect(result.metadata.authorName).toBe("Test Channel");
    expect(result.outputPath).toContain("test-song.mp3");
    expect(result.format.id).toBe("mp3");
  });

  it("getMetadata returns video metadata", async () => {
    const service = createService();
    const metadata = await service.getMetadata(
      "https://www.youtube.com/watch?v=abc"
    );
    expect(metadata.title).toBe("Test Video");
  });

  it("listFormats returns backend formats", async () => {
    const service = createService();
    const formats = service.listFormats();
    expect(formats.map((f) => f.id)).toContain("mp3");
    expect(formats.map((f) => f.id)).toContain("mp4");
  });

  it("listBackends returns registered backend names", async () => {
    const service = createService();
    expect(service.listBackends()).toContain("fake");
  });

  it("throws ValidationError on missing link", async () => {
    const service = createService();
    expect(
      service.download({ link: "", format: "mp3", name: "test" })
    ).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError on non-YouTube URL", async () => {
    const service = createService();
    expect(
      service.download({
        link: "https://vimeo.com/123",
        format: "mp3",
        name: "test",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError on unsupported format", async () => {
    const service = createService();
    expect(
      service.download({
        link: "https://www.youtube.com/watch?v=abc",
        format: "wav",
        name: "test",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("throws on unknown backend", () => {
    const backends = new BackendRegistry();
    backends.register(fakeBackend());
    expect(
      () =>
        new DownloadService({
          backend: "nonexistent",
          backends,
        })
    ).toThrow("Unknown backend");
  });

  it("forwards onProgress callback to backend", async () => {
    let receivedCallback: ProgressCallback | undefined;
    const backend = fakeBackend((onProgress) => {
      receivedCallback = onProgress;
    });
    const service = createService({ backend });
    const progressFn: ProgressCallback = () => {};

    await service.download(
      {
        link: "https://www.youtube.com/watch?v=abc",
        format: "mp3",
        name: "test-song",
        destination: "/tmp/yt-test",
      },
      progressFn
    );

    expect(receivedCallback).toBe(progressFn);
  });

  it("does not pass callback when none provided", async () => {
    let receivedCallback: ProgressCallback | undefined = undefined;
    const backend = fakeBackend((onProgress) => {
      receivedCallback = onProgress;
    });
    const service = createService({ backend });

    await service.download({
      link: "https://www.youtube.com/watch?v=abc",
      format: "mp3",
      name: "test-song",
      destination: "/tmp/yt-test",
    });

    expect(receivedCallback).toBeUndefined();
  });
});
