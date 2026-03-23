import { spawn } from "child_process";
import type { IProcessSpawner, SpawnResult } from "../types/IProcessSpawner";

export class NodeProcessSpawner implements IProcessSpawner {
  async spawn(
    args: string[],
    options: { stdout: "inherit"; stderr: "inherit" }
  ): Promise<SpawnResult> {
    const [command, ...rest] = args;
    return new Promise((resolve) => {
      const proc = spawn(command, rest, {
        stdio: [options.stdout, options.stdout, options.stderr],
      });
      proc.on("close", (code) => {
        resolve({ exitCode: code ?? 1 });
      });
    });
  }
}
