import type { IPrompter } from "../types/IPrompter";

export class ConsolePrompter implements IPrompter {
  prompt(message: string): string | null {
    return globalThis.prompt(message)?.trim() ?? null;
  }
}
