import whichSync from "which";
import type { IBinaryResolver } from "../types/IBinaryResolver";

export class NodeBinaryResolver implements IBinaryResolver {
  resolve(binary: string): string | null {
    try {
      return whichSync.sync(binary);
    } catch {
      return null;
    }
  }
}
