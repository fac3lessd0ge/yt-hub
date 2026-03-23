import createPrompt from "prompt-sync";
import type { IPrompter } from "../types/IPrompter";

const prompt = createPrompt();

export class ConsolePrompter implements IPrompter {
  prompt(message: string): string | null {
    const result = prompt(message);
    return result?.trim() ?? null;
  }
}
