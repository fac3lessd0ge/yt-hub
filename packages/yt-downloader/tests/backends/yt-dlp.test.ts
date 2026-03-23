import { describe, it, expect, vi } from "vitest";
import { YtDlpBackend, DownloadError } from "~/download";
import type { IProcessSpawner, SpawnOptions, SpawnResult } from "~/process";

function fakeSpawner(exitCode: number = 0) {
  const calls: { args: string[]; options: SpawnOptions }[] = [];
  const spawner: IProcessSpawner = {
    async spawn(args, options): Promise<SpawnResult> {
      calls.push({ args, options });
      return { exitCode };
    },
  };
  return { spawner, getCalls: () => calls };
}

function fakeSpawnerWithProgress(lines: string[], exitCode: number = 0) {
  const calls: { args: string[]; options: SpawnOptions }[] = [];
  const spawner: IProcessSpawner = {
    async spawn(args, options): Promise<SpawnResult> {
      calls.push({ args, options });
      if (options.onStdout) {
        for (const line of lines) {
          options.onStdout(line);
        }
      }
      return { exitCode };
    },
  };
  return { spawner, getCalls: () => calls };
}

describe("YtDlpBackend", () => {
  it("name is yt-dlp", () => {
    const { spawner } = fakeSpawner();
    expect(new YtDlpBackend(spawner).name).toBe("yt-dlp");
  });

  it("supportedFormats returns mp3 and mp4", () => {
    const { spawner } = fakeSpawner();
    const formats = new YtDlpBackend(spawner).supportedFormats();
    const ids = formats.map((f) => f.id);
    expect(ids).toContain("mp3");
    expect(ids).toContain("mp4");
    expect(formats.find((f) => f.id === "mp3")!.label).toBe("MP3 audio");
    expect(formats.find((f) => f.id === "mp4")!.label).toBe("MP4 video");
  });

  it("requiredDependencies returns yt-dlp and ffmpeg", () => {
    const { spawner } = fakeSpawner();
    const deps = new YtDlpBackend(spawner).requiredDependencies();
    const binaries = deps.map((d) => d.binary);
    expect(binaries).toContain("yt-dlp");
    expect(binaries).toContain("ffmpeg");
  });

  it("download spawns yt-dlp with mp3 args", async () => {
    const { spawner, getCalls } = fakeSpawner(0);
    const backend = new YtDlpBackend(spawner);
    await backend.download("https://www.youtube.com/watch?v=abc", "/tmp/test.mp3", "mp3");
    const args = getCalls()[0].args;
    expect(args[0]).toBe("yt-dlp");
    expect(args).toContain("-x");
    expect(args).toContain("--audio-format");
    expect(args).toContain("mp3");
    expect(args).toContain("--no-playlist");
    expect(args).toContain("-o");
    expect(args).toContain("/tmp/test.mp3");
    expect(args[args.length - 1]).toBe("https://www.youtube.com/watch?v=abc");
  });

  it("download spawns yt-dlp with mp4 args", async () => {
    const { spawner, getCalls } = fakeSpawner(0);
    const backend = new YtDlpBackend(spawner);
    await backend.download("https://www.youtube.com/watch?v=abc", "/tmp/test.mp4", "mp4");
    const args = getCalls()[0].args;
    expect(args).toContain("--merge-output-format");
    expect(args).toContain("mp4");
    expect(args).toContain("-f");
    expect(args).toContain("bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b");
  });

  it("uses inherited stdout and stderr", async () => {
    const { spawner, getCalls } = fakeSpawner(0);
    const backend = new YtDlpBackend(spawner);
    await backend.download("https://www.youtube.com/watch?v=abc", "/tmp/test.mp3", "mp3");
    const options = getCalls()[0].options;
    expect(options.stdout).toBe("inherit");
    expect(options.stderr).toBe("inherit");
  });

  it("throws DownloadError on non-zero exit code", async () => {
    const { spawner } = fakeSpawner(1);
    const backend = new YtDlpBackend(spawner);
    await expect(backend.download("https://www.youtube.com/watch?v=abc", "/tmp/test.mp3", "mp3")).rejects.toThrow(DownloadError);
  });

  it("DownloadError contains exit code", async () => {
    const { spawner } = fakeSpawner(2);
    const backend = new YtDlpBackend(spawner);
    try {
      await backend.download("https://www.youtube.com/watch?v=abc", "/tmp/test.mp3", "mp3");
    } catch (e) {
      expect(e).toBeInstanceOf(DownloadError);
      expect((e as DownloadError).exitCode).toBe(2);
    }
  });

  it("includes --progress flag", async () => {
    const { spawner, getCalls } = fakeSpawner(0);
    const backend = new YtDlpBackend(spawner);
    await backend.download("https://www.youtube.com/watch?v=abc", "/tmp/test.mp3", "mp3");
    expect(getCalls()[0].args).toContain("--progress");
  });

  it("uses inherited stdio when no onProgress callback", async () => {
    const { spawner, getCalls } = fakeSpawner(0);
    const backend = new YtDlpBackend(spawner);
    await backend.download("https://www.youtube.com/watch?v=abc", "/tmp/test.mp3", "mp3");
    const options = getCalls()[0].options;
    expect(options.stdout).toBe("inherit");
    expect(options.stderr).toBe("inherit");
    expect(options.onStdout).toBeUndefined();
  });

  it("uses piped stdio when onProgress callback is provided", async () => {
    const { spawner, getCalls } = fakeSpawner(0);
    const backend = new YtDlpBackend(spawner);
    await backend.download(
      "https://www.youtube.com/watch?v=abc",
      "/tmp/test.mp3",
      "mp3",
      () => {}
    );
    const options = getCalls()[0].options;
    expect(options.stdout).toBe("pipe");
    expect(options.stderr).toBe("pipe");
    expect(options.onStdout).toBeDefined();
  });

  it("calls onProgress with parsed progress from yt-dlp output", async () => {
    const lines = [
      "[info] Extracting URL",
      "[download]  25.0% of  10.00MiB at  2.00MiB/s ETA 00:04",
      "[download]  75.5% of  10.00MiB at  3.00MiB/s ETA 00:01",
      "[download] 100% of   10.00MiB in 00:03",
    ];
    const { spawner } = fakeSpawnerWithProgress(lines);
    const backend = new YtDlpBackend(spawner);
    const progressUpdates: any[] = [];

    await backend.download(
      "https://www.youtube.com/watch?v=abc",
      "/tmp/test.mp3",
      "mp3",
      (progress) => progressUpdates.push(progress)
    );

    expect(progressUpdates).toHaveLength(2);
    expect(progressUpdates[0]).toEqual({
      percent: 25.0,
      speed: "2.00MiB/s",
      eta: "00:04",
    });
    expect(progressUpdates[1]).toEqual({
      percent: 75.5,
      speed: "3.00MiB/s",
      eta: "00:01",
    });
  });
});
