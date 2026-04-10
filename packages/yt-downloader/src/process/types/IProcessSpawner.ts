export interface SpawnResult {
  exitCode: number;
  stderr?: string;
}

export interface SpawnOptions {
  stdout: "inherit" | "pipe";
  stderr: "inherit" | "pipe";
  onStdout?: (line: string) => void;
  signal?: AbortSignal;
  timeout?: number;
}

export interface IProcessSpawner {
  spawn(args: string[], options: SpawnOptions): Promise<SpawnResult>;
}
