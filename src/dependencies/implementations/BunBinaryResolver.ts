import type { IBinaryResolver } from "../types/IBinaryResolver";

export class BunBinaryResolver implements IBinaryResolver {
  resolve(binary: string): string | null {
    return Bun.which(binary) ?? null;
  }
}
