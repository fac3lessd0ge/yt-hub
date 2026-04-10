import { spawn } from "node:child_process";
import { createInterface, type Interface } from "node:readline";
import { CancellationError } from "~/download/errors/CancellationError";
import { TimeoutError } from "~/download/errors/TimeoutError";
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
      let settled = false;

      const settle = <T>(
        fn: (value: T) => void,
        value: T,
      ): void => {
        if (settled) return;
        settled = true;
        fn(value);
      };

      const proc = spawn(command, rest, {
        stdio: isPiped
          ? ["ignore", "pipe", "pipe"]
          : [options.stdout, options.stdout, options.stderr],
      });

      let onAbort: (() => void) | undefined;

      if (options.signal) {
        if (options.signal.aborted) {
          proc.kill("SIGTERM");
          settle(reject, new CancellationError());
          return;
        }
        onAbort = () => {
          proc.kill("SIGTERM");
          settle(reject, new CancellationError());
        };
        options.signal.addEventListener("abort", onAbort, { once: true });
      }

      let timeoutId: NodeJS.Timeout | undefined;
      if (options.timeout) {
        const timeoutMs = options.timeout;
        timeoutId = setTimeout(() => {
          proc.kill("SIGTERM");
          settle(reject, new TimeoutError(timeoutMs));
          setTimeout(() => {
            if (!proc.killed) proc.kill("SIGKILL");
          }, 5000);
        }, timeoutMs);
      }

      let rl: Interface | undefined;
      if (isPiped && options.onStdout && proc.stdout) {
        rl = createInterface({ input: proc.stdout });
        rl.on("line", (line) => options.onStdout?.(line));
      }

      const stderrLines: string[] = [];
      let rlStderr: Interface | undefined;
      if (isPiped && proc.stderr) {
        rlStderr = createInterface({ input: proc.stderr });
        rlStderr.on("line", (line) => stderrLines.push(line));
      }

      proc.on("close", (code) => {
        rl?.close();
        rlStderr?.close();
        if (timeoutId) clearTimeout(timeoutId);
        if (onAbort && options.signal) {
          options.signal.removeEventListener("abort", onAbort);
        }
        settle(resolve, {
          exitCode: code ?? 1,
          stderr: stderrLines.length > 0 ? stderrLines.join("\n") : undefined,
        });
      });
    });
  }
}
