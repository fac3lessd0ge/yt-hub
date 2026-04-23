import { describe, expect, it, vi } from "vitest";
import { showItemInFolder } from "@/main/showItemInFolder";

function makeDeps(
  overrides: Partial<Parameters<typeof showItemInFolder>[1]> = {},
) {
  return {
    access: vi.fn().mockResolvedValue(undefined),
    showItemInFolder: vi.fn(),
    openPath: vi.fn().mockResolvedValue(""),
    ...overrides,
  };
}

describe("showItemInFolder", () => {
  it("calls shell.showItemInFolder when the file exists (any drive)", async () => {
    const deps = makeDeps();
    await showItemInFolder("E:\\Videos\\clip.mp4", deps);
    expect(deps.showItemInFolder).toHaveBeenCalledTimes(1);
    expect(deps.openPath).not.toHaveBeenCalled();
  });

  it("falls back to shell.openPath(parent) when the file is gone but parent exists", async () => {
    let call = 0;
    const deps = makeDeps({
      access: vi.fn(async () => {
        call++;
        if (call === 1) throw new Error("ENOENT: file");
      }),
    });
    await showItemInFolder("/tmp/moved/clip.mp4", deps);
    expect(deps.showItemInFolder).not.toHaveBeenCalled();
    expect(deps.openPath).toHaveBeenCalledTimes(1);
  });

  it("throws a clear error when both file and parent are gone", async () => {
    const deps = makeDeps({
      access: vi.fn().mockRejectedValue(new Error("ENOENT")),
    });
    await expect(
      showItemInFolder("/gone/also-gone/clip.mp4", deps),
    ).rejects.toThrow("File and its containing folder no longer exist");
    expect(deps.showItemInFolder).not.toHaveBeenCalled();
    expect(deps.openPath).not.toHaveBeenCalled();
  });

  it("rejects non-string input", async () => {
    const deps = makeDeps();
    await expect(showItemInFolder(123, deps)).rejects.toThrow(
      "Invalid file path",
    );
    await expect(showItemInFolder(null, deps)).rejects.toThrow(
      "Invalid file path",
    );
  });

  it("rejects null-byte in path", async () => {
    const deps = makeDeps();
    await expect(showItemInFolder("/tmp/evil\0name", deps)).rejects.toThrow(
      "Invalid file path",
    );
  });
});
