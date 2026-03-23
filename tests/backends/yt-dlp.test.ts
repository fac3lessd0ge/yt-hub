import { describe, it, expect } from "bun:test";
import { YtDlpBackend, DownloadError } from "~/download";
import type { IProcessSpawner, SpawnResult } from "~/process";

function fakeSpawner(exitCode: number = 0) {
  const calls: { args: string[]; options: any }[] = [];
  const spawner: IProcessSpawner = {
    async spawn(args, options): Promise<SpawnResult> {
      calls.push({ args, options });
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
    expect(backend.download("https://www.youtube.com/watch?v=abc", "/tmp/test.mp3", "mp3")).rejects.toThrow(DownloadError);
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
});
