import { describe, expect, it } from "vitest";
import { loadConfig } from "~/config";
import { createLogger } from "~/logger";

function withEnv<T>(env: Record<string, string | undefined>, fn: () => T): T {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe("loadConfig — retention", () => {
  it("has sensible defaults", () => {
    const cfg = withEnv(
      {
        DOWNLOAD_RETENTION_MINUTES: undefined,
        DOWNLOAD_SWEEP_INTERVAL_SECONDS: undefined,
        DOWNLOAD_CLEANUP_DISABLED: undefined,
        INTERNAL_API_KEY: "sixteencharslong",
        FILE_DELIVERY_MODE: "local",
      },
      () => loadConfig(createLogger("silent")),
    );
    expect(cfg.downloadRetentionMinutes).toBe(60);
    expect(cfg.downloadSweepIntervalSeconds).toBe(300);
    expect(cfg.downloadCleanupDisabled).toBe(false);
  });

  it("reads overrides", () => {
    const cfg = withEnv(
      {
        DOWNLOAD_RETENTION_MINUTES: "15",
        DOWNLOAD_SWEEP_INTERVAL_SECONDS: "120",
        DOWNLOAD_CLEANUP_DISABLED: "true",
        FILE_DELIVERY_MODE: "local",
      },
      () => loadConfig(createLogger("silent")),
    );
    expect(cfg.downloadRetentionMinutes).toBe(15);
    expect(cfg.downloadSweepIntervalSeconds).toBe(120);
    expect(cfg.downloadCleanupDisabled).toBe(true);
  });

  it("rejects retention < 1 minute", () => {
    expect(() =>
      withEnv(
        { DOWNLOAD_RETENTION_MINUTES: "0", FILE_DELIVERY_MODE: "local" },
        () => loadConfig(createLogger("silent")),
      ),
    ).toThrow(/DOWNLOAD_RETENTION_MINUTES/);
  });

  it("rejects sweep interval < 60s", () => {
    expect(() =>
      withEnv(
        { DOWNLOAD_SWEEP_INTERVAL_SECONDS: "30", FILE_DELIVERY_MODE: "local" },
        () => loadConfig(createLogger("silent")),
      ),
    ).toThrow(/DOWNLOAD_SWEEP_INTERVAL_SECONDS/);
  });

  it("accepts retention = 1 (minimum)", () => {
    const cfg = withEnv(
      { DOWNLOAD_RETENTION_MINUTES: "1", FILE_DELIVERY_MODE: "local" },
      () => loadConfig(createLogger("silent")),
    );
    expect(cfg.downloadRetentionMinutes).toBe(1);
  });

  it("accepts sweep interval = 60 (minimum)", () => {
    const cfg = withEnv(
      { DOWNLOAD_SWEEP_INTERVAL_SECONDS: "60", FILE_DELIVERY_MODE: "local" },
      () => loadConfig(createLogger("silent")),
    );
    expect(cfg.downloadSweepIntervalSeconds).toBe(60);
  });
});
