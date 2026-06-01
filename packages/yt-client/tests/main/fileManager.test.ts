import { describe, expect, it } from "vitest";
import { fileManagerGdbusArgs } from "@/main/fileManager";

describe("fileManagerGdbusArgs", () => {
  it("targets the FileManager1 ShowItems method with the URI as a GVariant array", () => {
    const args = fileManagerGdbusArgs(
      "ShowItems",
      "file:///home/u/Downloads/song.mp3",
    );
    expect(args).toContain("--dest");
    expect(args).toContain("org.freedesktop.FileManager1");
    expect(args).toContain("org.freedesktop.FileManager1.ShowItems");
    expect(args).toContain('["file:///home/u/Downloads/song.mp3"]');
    // last arg is the (empty) startup id
    expect(args[args.length - 1]).toBe("");
  });

  it("supports ShowFolders for opening a directory", () => {
    const args = fileManagerGdbusArgs("ShowFolders", "file:///home/u/Music");
    expect(args).toContain("org.freedesktop.FileManager1.ShowFolders");
    expect(args).toContain('["file:///home/u/Music"]');
  });
});
