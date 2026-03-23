import type { IBinaryResolver } from "./types/IBinaryResolver";
import type { Dependency } from "./types/Dependency";
import { DependencyError } from "./errors/DependencyError";

export class DependencyChecker {
  constructor(private resolver: IBinaryResolver) {}

  check(dependencies: Dependency[]): void {
    for (const dep of dependencies) {
      if (!this.resolver.resolve(dep.binary)) {
        throw new DependencyError(dep.binary, dep.installHint);
      }
    }
  }
}
