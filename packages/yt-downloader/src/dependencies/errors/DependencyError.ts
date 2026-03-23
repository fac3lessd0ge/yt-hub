export class DependencyError extends Error {
  constructor(binary: string, installHint: string) {
    super(`${binary} is not installed. Run: ${installHint}`);
    this.name = "DependencyError";
  }
}
