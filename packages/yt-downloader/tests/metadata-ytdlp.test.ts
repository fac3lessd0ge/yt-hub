import { describe, expect, it } from "vitest";
import type { IBinaryResolver } from "~/dependencies";
import { MetadataError, YtDlpMetadataFetcher } from "~/metadata";
import type { IProcessSpawner, SpawnOptions, SpawnResult } from "~/process";

const YT_URL = "https://www.youtube.com/watch?v=abc";
const SC_URL = "https://soundcloud.com/artist/track";

function fakeResolver(path: string | null): IBinaryResolver {
  return { resolve: () => path };
}

/**
 * Spawner that emits a JSON document line-by-line via onStdout (mirroring how
 * NodeProcessSpawner streams stdout), then resolves with the given exit code.
 */
function fakeSpawner(json: unknown, exitCode = 0) {
  const calls: { args: string[]; options: SpawnOptions }[] = [];
  const spawner: IProcessSpawner = {
    async spawn(args, options): Promise<SpawnResult> {
      calls.push({ args, options });
      if (options.onStdout && json !== undefined) {
        for (const line of JSON.stringify(json).split("\n")) {
          options.onStdout(line);
        }
      }
      return { exitCode };
    },
  };
  return { spawner, getCalls: () => calls };
}

function rawSpawner(lines: string[], exitCode = 0) {
  const spawner: IProcessSpawner = {
    async spawn(_args, options): Promise<SpawnResult> {
      if (options.onStdout) {
        for (const line of lines) options.onStdout(line);
      }
      return { exitCode };
    },
  };
  return spawner;
}

describe("YtDlpMetadataFetcher", () => {
  it("maps title, author, thumbnail, and duration", async () => {
    const { spawner } = fakeSpawner({
      title: "Some Video",
      uploader: "Some Channel",
      thumbnail: "https://img.example/cover.jpg",
      duration: 213,
      vcodec: "avc1",
    });
    const fetcher = new YtDlpMetadataFetcher(
      spawner,
      fakeResolver("/bin/yt-dlp"),
    );
    const meta = await fetcher.fetch(YT_URL);
    expect(meta.title).toBe("Some Video");
    expect(meta.authorName).toBe("Some Channel");
    expect(meta.thumbnail).toBe("https://img.example/cover.jpg");
    expect(meta.durationSec).toBe(213);
  });

  it("video stream (vcodec present) → isAudioOnly false", async () => {
    const { spawner } = fakeSpawner({
      title: "Video",
      uploader: "Chan",
      vcodec: "avc1",
    });
    const fetcher = new YtDlpMetadataFetcher(
      spawner,
      fakeResolver("/bin/yt-dlp"),
    );
    const meta = await fetcher.fetch(YT_URL);
    expect(meta.isAudioOnly).toBe(false);
  });

  it("audio-only (vcodec none) → isAudioOnly true", async () => {
    const { spawner } = fakeSpawner({
      title: "Song",
      uploader: "Artist",
      vcodec: "none",
    });
    const fetcher = new YtDlpMetadataFetcher(
      spawner,
      fakeResolver("/bin/yt-dlp"),
    );
    const meta = await fetcher.fetch(SC_URL);
    expect(meta.isAudioOnly).toBe(true);
  });

  it("missing vcodec on an audio source → isAudioOnly true", async () => {
    const { spawner } = fakeSpawner({ title: "Song", uploader: "Artist" });
    const fetcher = new YtDlpMetadataFetcher(
      spawner,
      fakeResolver("/bin/yt-dlp"),
    );
    const meta = await fetcher.fetch(SC_URL);
    expect(meta.isAudioOnly).toBe(true);
  });

  it("missing vcodec on a video source → isAudioOnly false (not flipped)", async () => {
    const { spawner } = fakeSpawner({ title: "Video", uploader: "Creator" });
    const fetcher = new YtDlpMetadataFetcher(
      spawner,
      fakeResolver("/bin/yt-dlp"),
    );
    const meta = await fetcher.fetch(YT_URL);
    expect(meta.isAudioOnly).toBe(false);
  });

  it("falls back through channel / uploader_id / Unknown for author", async () => {
    const { spawner } = fakeSpawner({
      title: "T",
      channel: "ChannelName",
      vcodec: "avc1",
    });
    const f1 = new YtDlpMetadataFetcher(spawner, fakeResolver("/bin/yt-dlp"));
    expect((await f1.fetch(YT_URL)).authorName).toBe("ChannelName");

    const f2 = new YtDlpMetadataFetcher(
      fakeSpawner({ title: "T", vcodec: "avc1" }).spawner,
      fakeResolver("/bin/yt-dlp"),
    );
    expect((await f2.fetch(YT_URL)).authorName).toBe("Unknown");
  });

  it("stamps the detected source on the metadata", async () => {
    const ytFetcher = new YtDlpMetadataFetcher(
      fakeSpawner({ title: "T", vcodec: "avc1" }).spawner,
      fakeResolver("/bin/yt-dlp"),
    );
    expect((await ytFetcher.fetch(YT_URL)).source).toBe("youtube");

    const scFetcher = new YtDlpMetadataFetcher(
      fakeSpawner({ title: "T", vcodec: "none" }).spawner,
      fakeResolver("/bin/yt-dlp"),
    );
    expect((await scFetcher.fetch(SC_URL)).source).toBe("soundcloud");
  });

  it("uses the resolved yt-dlp path and expected flags", async () => {
    const { spawner, getCalls } = fakeSpawner({ title: "T", vcodec: "avc1" });
    const fetcher = new YtDlpMetadataFetcher(
      spawner,
      fakeResolver("/bin/yt-dlp"),
    );
    await fetcher.fetch(YT_URL);
    const args = getCalls()[0].args;
    expect(args[0]).toBe("/bin/yt-dlp");
    expect(args).toContain("--skip-download");
    expect(args).toContain("--dump-single-json");
    expect(args).toContain("--no-playlist");
    expect(args[args.length - 1]).toBe(YT_URL);
  });

  it("passes proxy / cookies / socket-timeout from config", async () => {
    const { spawner, getCalls } = fakeSpawner({ title: "T", vcodec: "avc1" });
    const fetcher = new YtDlpMetadataFetcher(
      spawner,
      fakeResolver("/bin/yt-dlp"),
      {
        audioQuality: "0",
        customArgs: [],
        proxy: "socks5://127.0.0.1:2080",
        cookiesFile: "/tmp/cookies.txt",
        socketTimeout: 30,
        processTimeout: 3600,
      },
    );
    await fetcher.fetch(YT_URL);
    const args = getCalls()[0].args;
    expect(args[args.indexOf("--proxy") + 1]).toBe("socks5://127.0.0.1:2080");
    expect(args[args.indexOf("--cookies") + 1]).toBe("/tmp/cookies.txt");
    expect(args[args.indexOf("--socket-timeout") + 1]).toBe("30");
  });

  it("throws MetadataError when the yt-dlp binary is missing", async () => {
    const { spawner } = fakeSpawner({ title: "T" });
    const fetcher = new YtDlpMetadataFetcher(spawner, fakeResolver(null));
    await expect(fetcher.fetch(YT_URL)).rejects.toThrow(MetadataError);
    await expect(fetcher.fetch(YT_URL)).rejects.toThrow(/not installed/i);
  });

  it("throws MetadataError on non-zero exit (private / not found)", async () => {
    const fetcher = new YtDlpMetadataFetcher(
      rawSpawner([], 1),
      fakeResolver("/bin/yt-dlp"),
    );
    await expect(fetcher.fetch(YT_URL)).rejects.toThrow(MetadataError);
    await expect(fetcher.fetch(YT_URL)).rejects.toThrow(
      /not found or requires login/i,
    );
  });

  it("throws MetadataError on malformed JSON", async () => {
    const fetcher = new YtDlpMetadataFetcher(
      rawSpawner(["not json at all"], 0),
      fakeResolver("/bin/yt-dlp"),
    );
    await expect(fetcher.fetch(YT_URL)).rejects.toThrow(MetadataError);
  });

  it("throws MetadataError when title is missing", async () => {
    const { spawner } = fakeSpawner({ uploader: "X", vcodec: "avc1" });
    const fetcher = new YtDlpMetadataFetcher(
      spawner,
      fakeResolver("/bin/yt-dlp"),
    );
    await expect(fetcher.fetch(YT_URL)).rejects.toThrow(MetadataError);
  });
});
