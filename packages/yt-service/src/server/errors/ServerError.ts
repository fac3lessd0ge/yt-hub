export class ServerError extends Error {
  constructor(
    message: string,
    public readonly host: string,
    public readonly port: number,
  ) {
    super(message);
    this.name = "ServerError";
  }
}
