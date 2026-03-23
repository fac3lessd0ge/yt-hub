import { spawn } from "child_process";
import { createInterface } from "readline";
import type {
  IProcessSpawner,
  SpawnOptions,
  SpawnResult,
} from "../types/IProcessSpawner";

export class NodeProcessSpawner implements IProcessSpawner {
  async spawn(args: string[], options: SpawnOptions): Promise<SpawnResult> {
    const [command, ...rest] = args;
    const isPiped = options.stdout === "pipe";

    return new Promise((resolve) => {
      const proc = spawn(command, rest, {
        stdio: isPiped
          ? ["ignore", "pipe", "pipe"]
          : [options.stdout, options.stdout, options.stderr],
      });

      if (isPiped && options.onStdout && proc.stdout) {
        const rl = createInterface({ input: proc.stdout });
        rl.on("line", (line) => options.onStdout!(line));
      }

      proc.on("close", (code) => {
        resolve({ exitCode: code ?? 1 });
      });
    });
  }
}
