import { existsSync } from "node:fs";
import path from "node:path";
import whichSync from "which";
import type { IBinaryResolver } from "yt-downloader";

export interface BundledBinaryResolverDeps {
  /** Per-user writable bin dir, e.g. `app.getPath("userData")/bin`. */
  userBinDir: string;
  /** Bundled bin dir shipped via electron-forge `extraResource`. */
  resourcesBinDir: string;
  /** Existence check — injected for testing. */
  exists: (p: string) => boolean;
  /** PATH lookup — injected for testing. */
  which: (binary: string) => string | null;
  /** Host platform — injected for testing; controls the `.exe` suffix. */
  platform: NodeJS.Platform;
}

/**
 * Resolves backend binaries for the in-process {@link DownloadService}.
 *
 * Resolution order:
 *   1. `<userData>/bin/<binary>` — user-installed override.
 *   2. `<resourcesPath>/bin/<binary>` — bundled binary (extraResource; may not exist yet).
 *   3. PATH via `which`.
 *
 * On Windows, the bundled binaries are `<binary>.exe`, so that name is tried
 * first in the bin dirs (`which` already resolves the `.exe` on PATH).
 *
 * Returns an absolute path or `null` when the binary cannot be found.
 */
export class BundledBinaryResolver implements IBinaryResolver {
  private readonly deps: BundledBinaryResolverDeps;

  constructor(deps?: Partial<BundledBinaryResolverDeps>) {
    this.deps = {
      userBinDir: deps?.userBinDir ?? "",
      resourcesBinDir: deps?.resourcesBinDir ?? "",
      exists: deps?.exists ?? existsSync,
      which:
        deps?.which ??
        ((binary: string): string | null => {
          try {
            return whichSync.sync(binary);
          } catch {
            return null;
          }
        }),
      platform: deps?.platform ?? process.platform,
    };
  }

  resolve(binary: string): string | null {
    // On Windows the bundled binary is `<binary>.exe`; try it before the bare name.
    const names =
      this.deps.platform === "win32" ? [`${binary}.exe`, binary] : [binary];
    const binDirs = [this.deps.userBinDir, this.deps.resourcesBinDir].filter(
      (dir): dir is string => dir.length > 0,
    );

    for (const dir of binDirs) {
      for (const name of names) {
        const candidate = path.join(dir, name);
        if (this.deps.exists(candidate)) {
          return path.resolve(candidate);
        }
      }
    }

    const onPath = this.deps.which(binary);
    return onPath ? path.resolve(onPath) : null;
  }
}
