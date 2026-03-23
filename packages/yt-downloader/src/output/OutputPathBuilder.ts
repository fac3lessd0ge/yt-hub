import { extname, resolve } from "node:path";

export class OutputPathBuilder {
  build(name: string, formatId: string, destination: string): string {
    const baseName = extname(name)
      ? name.slice(0, -extname(name).length)
      : name;
    return resolve(destination, `${baseName}.${formatId}`);
  }
}
