import { readdir, stat, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Logger } from "~/logger";

export interface DownloadSweeperOptions {
  downloadDir: string;
  retentionMinutes: number;
  sweepIntervalSeconds: number;
  logger: Logger;
}

export interface SweepResult {
  scanned: number;
  deleted: number;
  freedBytes: number;
  durationMs: number;
  errors: number;
}

export class DownloadSweeper {
  private readonly downloadDir: string;
  private readonly retentionMs: number;
  private readonly sweepIntervalMs: number;
  private readonly logger: Logger;
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<SweepResult> | null = null;
  private state: "idle" | "running" | "stopped" = "idle";

  constructor(options: DownloadSweeperOptions) {
    this.downloadDir = resolve(options.downloadDir);
    this.retentionMs = options.retentionMinutes * 60 * 1000;
    this.sweepIntervalMs = options.sweepIntervalSeconds * 1000;
    this.logger = options.logger;
  }

  async start(): Promise<void> {
    if (this.state !== "idle") {
      throw new Error(
        `DownloadSweeper.start(): cannot start from state "${this.state}"`,
      );
    }
    this.state = "running";
    await this.runSweep();
    if (this.state !== "running") return; // stopped concurrently during initial sweep
    this.timer = setInterval(() => {
      this.runSweep().catch((err) => {
        this.logger.error({ err }, "download_sweep_tick_failed");
      });
    }, this.sweepIntervalMs);
    this.timer.unref();
  }

  async stop(): Promise<void> {
    if (this.state === "stopped") return;
    this.state = "stopped";
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.running) {
      await this.running.catch(() => {});
    }
  }

  /**
   * Trigger a sweep immediately. If a sweep is already running (e.g. an
   * interval tick is in flight), returns the in-flight promise instead of
   * starting a new one. Mainly useful for tests.
   */
  async sweepOnce(): Promise<SweepResult> {
    return this.runSweep();
  }

  private async runSweep(): Promise<SweepResult> {
    if (this.running) {
      return this.running;
    }
    const promise = this.doSweep();
    this.running = promise;
    try {
      return await promise;
    } finally {
      this.running = null;
    }
  }

  private async doSweep(): Promise<SweepResult> {
    const started = Date.now();
    const result: SweepResult = {
      scanned: 0,
      deleted: 0,
      freedBytes: 0,
      durationMs: 0,
      errors: 0,
    };

    let entries: string[];
    try {
      entries = await readdir(this.downloadDir);
    } catch (err) {
      this.logger.warn(
        { err, dir: this.downloadDir },
        "download_sweep_readdir_failed",
      );
      result.durationMs = Date.now() - started;
      return result;
    }

    const cutoff = Date.now() - this.retentionMs;

    for (const name of entries) {
      if (name.startsWith(".")) continue;
      result.scanned++;
      const full = join(this.downloadDir, name);
      try {
        const st = await stat(full);
        if (!st.isFile()) continue;
        if (st.mtimeMs > cutoff) continue;
        try {
          await unlink(full);
          result.deleted++;
          result.freedBytes += st.size;
          this.logger.debug(
            {
              file: name,
              sizeBytes: st.size,
              ageMs: Date.now() - st.mtimeMs,
            },
            "download_sweep_deleted",
          );
        } catch (err) {
          result.errors++;
          this.logger.warn({ err, file: name }, "download_sweep_unlink_failed");
        }
      } catch (err) {
        result.errors++;
        this.logger.warn({ err, file: name }, "download_sweep_stat_failed");
      }
    }

    result.durationMs = Date.now() - started;
    this.logger.info(
      {
        scanned: result.scanned,
        deleted: result.deleted,
        freedBytes: result.freedBytes,
        durationMs: result.durationMs,
        errors: result.errors,
      },
      "download_sweep",
    );
    return result;
  }
}
