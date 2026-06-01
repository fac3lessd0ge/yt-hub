import { describe, expect, it, vi } from "vitest";
import { showItemInFolder } from "@/main/showItemInFolder";

function makeDeps(
  overrides: Partial<Parameters<typeof showItemInFolder>[1]> = {},
) {
  return {
    access: vi.fn().mockResolvedValue(undefined),
    revealItem: vi.fn().mockResolvedValue(false),
    revealFolder: vi.fn().mockResolvedValue(false),
    showItemInFolder: vi.fn(),
    openPath: vi.fn().mockResolvedValue(""),
    ...overrides,
  };
}

describe("showItemInFolder", () => {
  it("prefers the GUI file manager (revealItem) when the file exists", async () => {
    const deps = makeDeps({ revealItem: vi.fn().mockResolvedValue(true) });
    await showItemInFolder("/home/u/Downloads/clip.mp4", deps);
    expect(deps.revealItem).toHaveBeenCalledTimes(1);
    expect(deps.showItemInFolder).not.toHaveBeenCalled();
    expect(deps.openPath).not.toHaveBeenCalled();
  });

  it("falls back to shell.showItemInFolder when revealItem is unavailable", async () => {
    const deps = makeDeps();
    await showItemInFolder("E:\\Videos\\clip.mp4", deps);
    expect(deps.revealItem).toHaveBeenCalledTimes(1);
    expect(deps.showItemInFolder).toHaveBeenCalledTimes(1);
    expect(deps.openPath).not.toHaveBeenCalled();
  });

  it("opens the folder via the GUI file manager when the file is gone", async () => {
    let call = 0;
    const deps = makeDeps({
      access: vi.fn(async () => {
        call++;
        if (call === 1) throw new Error("ENOENT: file");
      }),
      revealFolder: vi.fn().mockResolvedValue(true),
    });
    await showItemInFolder("/tmp/moved/clip.mp4", deps);
    expect(deps.revealFolder).toHaveBeenCalledTimes(1);
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

  it("surfaces openPath OS errors instead of masking them as 'folder gone'", async () => {
    let call = 0;
    const deps = makeDeps({
      access: vi.fn(async () => {
        call++;
        if (call === 1) throw new Error("ENOENT: file");
      }),
      openPath: vi.fn().mockResolvedValue("permission denied"),
    });
    await expect(showItemInFolder("/tmp/moved/clip.mp4", deps)).rejects.toThrow(
      "Failed to open folder: permission denied",
    );
    expect(deps.openPath).toHaveBeenCalledTimes(1);
  });
});
