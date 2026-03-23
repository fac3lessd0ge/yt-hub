import { parseArgs } from "node:util";
import type { IDownloadBackend } from "~/download";
import type { IInputReader, RawInput } from "../types/IInputReader";
import type { IPrompter } from "../types/IPrompter";

export class CliInputReader implements IInputReader {
  constructor(
    private backend: IDownloadBackend,
    private prompter: IPrompter,
  ) {}

  read(): RawInput {
    const { values } = parseArgs({
      args: process.argv.slice(2),
      options: {
        link: { type: "string" },
        name: { type: "string" },
        format: { type: "string" },
        destination: { type: "string" },
        backend: { type: "string" },
      },
    });

    const formatIds = this.backend
      .supportedFormats()
      .map((f) => f.id)
      .join("/");

    const link = values.link ?? this.prompter.prompt("YouTube link:");
    const name = values.name ?? this.prompter.prompt("Output name:");
    const format =
      values.format ?? this.prompter.prompt(`Format (${formatIds}):")`);

    return {
      link: link || undefined,
      name: name || undefined,
      format: format || undefined,
      destination: values.destination || undefined,
      backend: values.backend || undefined,
    };
  }
}
