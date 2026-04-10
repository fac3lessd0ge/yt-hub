import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { Application } from "~/Application";
import type { IBinaryResolver } from "~/dependencies";
import { DependencyChecker } from "~/dependencies";
import type { IDownloadBackend } from "~/download";
import type { IFileSystem, ILogger } from "~/infra";
import type { IInputReader, RawInput } from "~/input";
import { InputValidator } from "~/input";
import { HttpMetadataFetcher } from "~/metadata";
import { OutputPathBuilder } from "~/output";

const OEMBED_URL = "https://www.youtube.com/oembed";
const server = setupServer(
  http.get(OEMBED_URL, () =>
    HttpResponse.json({ title: "Test Video", author_name: "Test Channel" }),
  ),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function fakeInputReader(input: RawInput): IInputReader {
  return { read: () => input };
}

function fakeBackend(downloadExitCode: number = 0): IDownloadBackend {
  return {
    name: "test",
    supportedFormats: () => [
      { id: "mp3", label: "MP3 audio" },
      { id: "mp4", label: "MP4 video" },
    ],
    requiredDependencies: () => [
      { binary: "test-bin", installHint: "brew install test-bin" },
    ],
    download: async () => {
      if (downloadExitCode !== 0) {
        const { DownloadError } = await import("../src/download");
        throw new DownloadError(downloadExitCode);
      }
    },
  };
}

const allResolved: IBinaryResolver = { resolve: () => "/usr/bin/mock" };
const fakeFs: IFileSystem = { mkdirRecursive: () => {} };
const fakeLogger: ILogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

function createApp(
  overrides: {
    reader?: IInputReader;
    resolver?: IBinaryResolver;
    backend?: IDownloadBackend;
  } = {},
): Application {
  const backend = overrides.backend ?? fakeBackend();
  return new Application(
    new DependencyChecker(overrides.resolver ?? allResolved),
    overrides.reader ??
      fakeInputReader({
        link: "https://www.youtube.com/watch?v=abc",
        name: "test",
        format: "mp3",
      }),
    new InputValidator(backend),
    new HttpMetadataFetcher(),
    backend,
    new OutputPathBuilder(),
    fakeFs,
    fakeLogger,
  );
}

describe("Application", () => {
  beforeEach(() => {
    vi.spyOn(process, "exit").mockImplementation(
      (_code?: number | string | null | undefined): never => {
        throw new Error("process.exit called");
      },
    );
  });

  it("runs full happy path without errors", async () => {
    await createApp().run();
    expect(process.exit).not.toHaveBeenCalled();
  });

  it("exits with 1 on validation error", async () => {
    try {
      await createApp({
        reader: fakeInputReader({
          link: "https://bad-url.com",
          name: "test",
          format: "mp3",
        }),
      }).run();
    } catch {}
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("exits with 1 on missing dependency", async () => {
    try {
      await createApp({ resolver: { resolve: () => null } }).run();
    } catch {}
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("exits with download error exit code on failure", async () => {
    try {
      await createApp({ backend: fakeBackend(2) }).run();
    } catch {}
    expect(process.exit).toHaveBeenCalledWith(2);
  });

  it("exits with 1 on metadata fetch failure", async () => {
    server.use(
      http.get(OEMBED_URL, () => new HttpResponse(null, { status: 404 })),
    );
    try {
      await createApp().run();
    } catch {}
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
