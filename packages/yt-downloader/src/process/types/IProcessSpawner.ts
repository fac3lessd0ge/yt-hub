export interface SpawnResult {
  exitCode: number;
}

export interface SpawnOptions {
  stdout: "inherit" | "pipe";
  stderr: "inherit" | "pipe";
  onStdout?: (line: string) => void;
}

export interface IProcessSpawner {
  spawn(args: string[], options: SpawnOptions): Promise<SpawnResult>;
}
