export class TimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Process timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
  }
}
