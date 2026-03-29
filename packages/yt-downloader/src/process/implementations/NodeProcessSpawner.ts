import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { CancellationError } from "~/download/errors/CancellationError";
import type {
  IProcessSpawner,
  SpawnOptions,
  SpawnResult,
} from "../types/IProcessSpawner";

export class NodeProcessSpawner implements IProcessSpawner {
  async spawn(args: string[], options: SpawnOptions): Promise<SpawnResult> {
    const [command, ...rest] = args;
    const isPiped = options.stdout === "pipe";

    return new Promise((resolve, reject) => {
      const proc = spawn(command, rest, {
        stdio: isPiped
          ? ["ignore", "pipe", "pipe"]
          : [options.stdout, options.stdout, options.stderr],
      });

      if (options.signal) {
        if (options.signal.aborted) {
          proc.kill("SIGTERM");
          reject(new CancellationError());
          return;
        }
        options.signal.addEventListener(
          "abort",
          () => {
            proc.kill("SIGTERM");
            reject(new CancellationError());
          },
          { once: true },
        );
      }

      if (isPiped && options.onStdout && proc.stdout) {
        const rl = createInterface({ input: proc.stdout });
        rl.on("line", (line) => options.onStdout?.(line));
      }

      proc.on("close", (code) => {
        resolve({ exitCode: code ?? 1 });
      });
    });
  }
}
