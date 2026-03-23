export interface SpawnResult {
  exitCode: number;
}

export interface IProcessSpawner {
  spawn(
    args: string[],
    options: { stdout: "inherit"; stderr: "inherit" }
  ): Promise<SpawnResult>;
}
