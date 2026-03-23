export class HandlerError extends Error {
  constructor(
    message: string,
    public readonly rpcMethod: string,
  ) {
    super(message);
    this.name = "HandlerError";
  }
}
