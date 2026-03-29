export interface SpawnResult {
  exitCode: number;
}

export interface SpawnOptions {
  stdout: "inherit" | "pipe";
  stderr: "inherit" | "pipe";
  onStdout?: (line: string) => void;
  signal?: AbortSignal;
}

export interface IProcessSpawner {
  spawn(args: string[], options: SpawnOptions): Promise<SpawnResult>;
}
