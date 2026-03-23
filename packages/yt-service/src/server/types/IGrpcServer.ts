export interface IGrpcServer {
  start(host: string, port: number): Promise<void>;
  stop(): Promise<void>;
}
