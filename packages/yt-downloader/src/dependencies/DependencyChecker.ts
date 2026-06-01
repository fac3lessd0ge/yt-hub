import { DependencyError } from "./errors/DependencyError";
import type { Dependency } from "./types/Dependency";
import type { IBinaryResolver } from "./types/IBinaryResolver";

export class DependencyChecker {
  constructor(private resolver: IBinaryResolver) {}

  /**
   * Resolves each dependency to its absolute binary path.
   *
   * @returns a map of binary name to resolved absolute path.
   * @throws {DependencyError} when a binary cannot be resolved.
   */
  check(dependencies: Dependency[]): ReadonlyMap<string, string> {
    const resolved = new Map<string, string>();
    for (const dep of dependencies) {
      const path = this.resolver.resolve(dep.binary);
      if (!path) {
        throw new DependencyError(dep.binary, dep.installHint);
      }
      resolved.set(dep.binary, path);
    }
    return resolved;
  }
}
