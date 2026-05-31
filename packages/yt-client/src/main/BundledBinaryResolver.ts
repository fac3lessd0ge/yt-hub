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
}

/**
 * Resolves backend binaries for the in-process {@link DownloadService}.
 *
 * Resolution order:
 *   1. `<userData>/bin/<binary>` — user-installed override.
 *   2. `<resourcesPath>/bin/<binary>` — bundled binary (extraResource; may not exist yet).
 *   3. PATH via `which`.
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
    };
  }

  resolve(binary: string): string | null {
    const candidates = [
      this.deps.userBinDir ? path.join(this.deps.userBinDir, binary) : null,
      this.deps.resourcesBinDir
        ? path.join(this.deps.resourcesBinDir, binary)
        : null,
    ];

    for (const candidate of candidates) {
      if (candidate && this.deps.exists(candidate)) {
        return path.resolve(candidate);
      }
    }

    const onPath = this.deps.which(binary);
    return onPath ? path.resolve(onPath) : null;
  }
}
