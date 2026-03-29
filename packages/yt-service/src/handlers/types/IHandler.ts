export interface IUnaryHandler<Req, Res> {
  handle(request: Req): Promise<Res>;
}

export interface IStreamHandler<Req, Res> {
  handle(
    request: Req,
    write: (msg: Res) => void,
    signal?: AbortSignal,
  ): Promise<void>;
}
