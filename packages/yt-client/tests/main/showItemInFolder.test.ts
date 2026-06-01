import { describe, expect, it, vi } from "vitest";
import { showItemInFolder } from "@/main/showItemInFolder";

function makeDeps(
  overrides: Partial<Parameters<typeof showItemInFolder>[1]> = {},
) {
  return {
    access: vi.fn().mockResolvedValue(undefined),
    openFolderInFileManager: vi.fn().mockResolvedValue(false),
    showItemNative: vi.fn(),
    openPath: vi.fn().mockResolvedValue(""),
    ...overrides,
  };
}

describe("showItemInFolder", () => {
  it("opens the exact containing folder via the file manager", async () => {
    const deps = makeDeps({
      openFolderInFileManager: vi.fn().mockResolvedValue(true),
    });
    await showItemInFolder("/home/u/Downloads/yt-hub/song.mp3", deps);
    expect(deps.openFolderInFileManager).toHaveBeenCalledWith(
      "/home/u/Downloads/yt-hub",
    );
    expect(deps.showItemNative).not.toHaveBeenCalled();
    expect(deps.openPath).not.toHaveBeenCalled();
  });

  it("highlights via native shell when the file manager is unavailable (Windows/macOS)", async () => {
    const deps = makeDeps();
    await showItemInFolder("E:\\Videos\\clip.mp4", deps);
    expect(deps.openFolderInFileManager).toHaveBeenCalledTimes(1);
    expect(deps.showItemNative).toHaveBeenCalledTimes(1);
    expect(deps.openPath).not.toHaveBeenCalled();
  });

  it("falls back to openPath(folder) when the file is gone but the folder exists", async () => {
    let call = 0;
    const deps = makeDeps({
      access: vi.fn(async () => {
        call++;
        if (call === 1) throw new Error("ENOENT: file");
      }),
    });
    await showItemInFolder("/tmp/moved/clip.mp4", deps);
    expect(deps.showItemNative).not.toHaveBeenCalled();
    expect(deps.openPath).toHaveBeenCalledTimes(1);
  });

  it("throws a clear error when both file and folder are gone", async () => {
    const deps = makeDeps({
      access: vi.fn().mockRejectedValue(new Error("ENOENT")),
    });
    await expect(
      showItemInFolder("/gone/also-gone/clip.mp4", deps),
    ).rejects.toThrow("File and its containing folder no longer exist");
    expect(deps.openFolderInFileManager).not.toHaveBeenCalled();
    expect(deps.showItemNative).not.toHaveBeenCalled();
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
