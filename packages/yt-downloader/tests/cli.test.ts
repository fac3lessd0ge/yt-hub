import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CliInputReader } from "~/input";
import type { IDownloadBackend } from "~/download";
import type { IPrompter } from "~/input";

function fakeBackend(): IDownloadBackend {
  return {
    name: "test",
    supportedFormats: () => [{ id: "mp3", label: "MP3" }, { id: "mp4", label: "MP4" }],
    requiredDependencies: () => [],
    download: async () => {},
  };
}

class FakePrompter implements IPrompter {
  private responses: (string | null)[] = [];
  calls: string[] = [];

  setResponses(...responses: (string | null)[]) {
    this.responses = [...responses];
  }

  prompt(message: string): string | null {
    this.calls.push(message);
    return this.responses.shift() ?? null;
  }
}

describe("CliInputReader", () => {
  let originalArgv: string[];
  let prompter: FakePrompter;
  let reader: CliInputReader;

  beforeEach(() => {
    originalArgv = process.argv;
    prompter = new FakePrompter();
    reader = new CliInputReader(fakeBackend(), prompter);
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  function setArgv(...flags: string[]) {
    process.argv = ["bun", "index.ts", ...flags];
  }

  it("parses --link, --name, --format from argv", () => {
    setArgv("--link", "https://youtube.com/watch?v=abc", "--name", "test", "--format", "mp3");
    const input = reader.read();
    expect(input.link).toBe("https://youtube.com/watch?v=abc");
    expect(input.name).toBe("test");
    expect(input.format).toBe("mp3");
    expect(prompter.calls.length).toBe(0);
  });

  it("parses --destination from argv", () => {
    setArgv("--link", "https://youtube.com/watch?v=abc", "--name", "test", "--format", "mp3", "--destination", "/tmp/downloads");
    expect(reader.read().destination).toBe("/tmp/downloads");
  });

  it("parses --backend from argv", () => {
    setArgv("--link", "https://youtube.com/watch?v=abc", "--name", "test", "--format", "mp3", "--backend", "cobalt");
    expect(reader.read().backend).toBe("cobalt");
  });

  it("does not prompt for destination or backend when missing", () => {
    setArgv("--link", "https://youtube.com/watch?v=abc", "--name", "test", "--format", "mp3");
    const input = reader.read();
    expect(input.destination).toBeUndefined();
    expect(input.backend).toBeUndefined();
    expect(prompter.calls.length).toBe(0);
  });

  it("returns undefined for missing flags when prompter returns null", () => {
    setArgv("--link", "https://youtube.com/watch?v=abc");
    const input = reader.read();
    expect(input.link).toBe("https://youtube.com/watch?v=abc");
    expect(input.name).toBeUndefined();
    expect(input.format).toBeUndefined();
    expect(prompter.calls.length).toBe(2);
  });

  it("returns all undefined when no flags and prompter returns null", () => {
    setArgv();
    const input = reader.read();
    expect(input.link).toBeUndefined();
    expect(input.name).toBeUndefined();
    expect(input.format).toBeUndefined();
    expect(prompter.calls.length).toBe(3);
  });

  it("uses prompter values when flags are missing", () => {
    setArgv("--link", "https://youtube.com/watch?v=abc");
    prompter.setResponses("my-video", "mp4");
    const input = reader.read();
    expect(input.name).toBe("my-video");
    expect(input.format).toBe("mp4");
  });
});
