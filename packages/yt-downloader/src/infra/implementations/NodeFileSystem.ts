import { mkdirSync } from "node:fs";
import type { IFileSystem } from "../types/IFileSystem";

export class NodeFileSystem implements IFileSystem {
  mkdirRecursive(path: string): void {
    mkdirSync(path, { recursive: true });
  }
}
