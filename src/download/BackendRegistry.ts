import type { IDownloadBackend } from "./types/IDownloadBackend";

export class BackendRegistry {
  private backends = new Map<string, IDownloadBackend>();

  register(backend: IDownloadBackend): void {
    this.backends.set(backend.name, backend);
  }

  get(name: string): IDownloadBackend | undefined {
    return this.backends.get(name);
  }

  names(): string[] {
    return [...this.backends.keys()];
  }
}
