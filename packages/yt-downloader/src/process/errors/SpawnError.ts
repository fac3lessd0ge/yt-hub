export class SpawnError extends Error {
  constructor(command: string, cause: Error) {
    super(`Failed to spawn "${command}": ${cause.message}`, { cause });
    this.name = "SpawnError";
  }
}
