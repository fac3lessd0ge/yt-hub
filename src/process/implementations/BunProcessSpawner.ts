import type { IProcessSpawner, SpawnResult } from "../types/IProcessSpawner";

export class BunProcessSpawner implements IProcessSpawner {
  async spawn(
    args: string[],
    options: { stdout: "inherit"; stderr: "inherit" }
  ): Promise<SpawnResult> {
    const proc = Bun.spawn(args, options);
    const exitCode = await proc.exited;
    return { exitCode };
  }
}
