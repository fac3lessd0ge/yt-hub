export class CancellationError extends Error {
  constructor() {
    super("Operation cancelled by client");
    this.name = "CancellationError";
  }
}
