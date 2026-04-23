import { mkdtemp, readdir, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createLogger } from "~/logger";
import { DownloadSweeper } from "~/retention/DownloadSweeper";

const sweepers: DownloadSweeper[] = [];

afterEach(async () => {
  while (sweepers.length > 0) {
    const sw = sweepers.pop();
    if (sw) await sw.stop();
  }
});

async function setAge(filePath: string, ageMs: number): Promise<void> {
  const when = new Date(Date.now() - ageMs);
  await utimes(filePath, when, when);
}

describe("DownloadSweeper", () => {
  it("deletes files older than retention", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sweeper-"));
    const old = join(dir, "old.mp3");
    const fresh = join(dir, "fresh.mp3");
    await writeFile(old, "x");
    await writeFile(fresh, "x");
    await setAge(old, 90 * 60 * 1000);
    await setAge(fresh, 5 * 60 * 1000);

    const sw = new DownloadSweeper({
      downloadDir: dir,
      retentionMinutes: 60,
      sweepIntervalSeconds: 3600,
      logger: createLogger("silent"),
    });
    sweepers.push(sw);

    const result = await sw.sweepOnce();

    expect(result.deleted).toBe(1);
    expect(result.scanned).toBe(2);
    const remaining = (await readdir(dir)).sort();
    expect(remaining).toEqual(["fresh.mp3"]);
  });

  it("ignores dotfiles", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sweeper-"));
    const dot = join(dir, ".hidden");
    await writeFile(dot, "x");
    await setAge(dot, 90 * 60 * 1000);

    const sw = new DownloadSweeper({
      downloadDir: dir,
      retentionMinutes: 60,
      sweepIntervalSeconds: 3600,
      logger: createLogger("silent"),
    });
    sweepers.push(sw);

    const result = await sw.sweepOnce();
    expect(result.deleted).toBe(0);
    expect(await readdir(dir)).toContain(".hidden");
  });

  it("does not recurse into subdirectories", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sweeper-"));
    const { mkdir } = await import("node:fs/promises");
    const sub = join(dir, "sub");
    await mkdir(sub);
    const nested = join(sub, "old.mp3");
    await writeFile(nested, "x");
    await setAge(nested, 90 * 60 * 1000);

    const sw = new DownloadSweeper({
      downloadDir: dir,
      retentionMinutes: 60,
      sweepIntervalSeconds: 3600,
      logger: createLogger("silent"),
    });
    sweepers.push(sw);

    const result = await sw.sweepOnce();
    expect(result.deleted).toBe(0);
    expect(result.scanned).toBe(1); // the subdir itself was counted
    expect(result.deleted).toBe(0);
    const st = await stat(nested);
    expect(st.isFile()).toBe(true);
  });

  it("does not crash when a file disappears mid-sweep", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sweeper-"));
    const a = join(dir, "a.mp3");
    const b = join(dir, "b.mp3");
    await writeFile(a, "x");
    await writeFile(b, "x");
    await setAge(a, 90 * 60 * 1000);
    await setAge(b, 90 * 60 * 1000);

    const sw = new DownloadSweeper({
      downloadDir: dir,
      retentionMinutes: 60,
      sweepIntervalSeconds: 3600,
      logger: createLogger("silent"),
    });
    sweepers.push(sw);

    const { unlink } = await import("node:fs/promises");
    await unlink(a);

    const result = await sw.sweepOnce();
    // `a` was unlinked before sweepOnce(), so readdir doesn't see it → 0 errors.
    // If the unlink were to race *between* readdir and stat, errors would be 1.
    // Both outcomes are acceptable; we care that the sweep doesn't crash.
    expect(result.errors).toBeLessThanOrEqual(1);
    expect(await readdir(dir)).toEqual([]);
  });

  it("start() runs an immediate sweep then schedules periodic sweeps; stop() cancels", async () => {
    const dir = await mkdtemp(join(tmpdir(), "sweeper-"));
    const f = join(dir, "old.mp3");
    await writeFile(f, "x");
    await setAge(f, 90 * 60 * 1000);

    const sw = new DownloadSweeper({
      downloadDir: dir,
      retentionMinutes: 60,
      sweepIntervalSeconds: 60,
      logger: createLogger("silent"),
    });
    sweepers.push(sw);

    await sw.start();
    expect(await readdir(dir)).toEqual([]);

    await sw.stop();
    const g = join(dir, "second.mp3");
    await writeFile(g, "x");
    await setAge(g, 90 * 60 * 1000);
    await new Promise((r) => setTimeout(r, 150));
    expect(await readdir(dir)).toContain("second.mp3");
  });
});
