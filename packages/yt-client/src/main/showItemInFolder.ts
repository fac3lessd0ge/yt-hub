import path from "node:path";

export interface ShowItemInFolderDeps {
  access: (p: string) => Promise<void>;
  /** Highlight a file in the GUI file manager (D-Bus on Linux); true if handled. */
  revealItem: (p: string) => Promise<boolean>;
  /** Open a folder in the GUI file manager (D-Bus on Linux); true if handled. */
  revealFolder: (p: string) => Promise<boolean>;
  /** Native fallback (Windows/macOS, or when the GUI reveal is unavailable). */
  showItemInFolder: (p: string) => void;
  /** Native folder-open fallback; resolves to an OS error string or "". */
  openPath: (p: string) => Promise<string>;
}

export async function showItemInFolder(
  filePath: unknown,
  deps: ShowItemInFolderDeps,
): Promise<void> {
  if (typeof filePath !== "string" || filePath.includes("\0")) {
    throw new Error("Invalid file path");
  }
  const resolved = path.resolve(filePath);

  let fileExists = true;
  try {
    await deps.access(resolved);
  } catch {
    fileExists = false;
  }

  if (fileExists) {
    // Prefer the registered GUI file manager (highlights the file); only fall
    // back to the native reveal, which on Linux uses xdg-open and may launch a
    // terminal depending on the inode/directory association.
    if (await deps.revealItem(resolved)) {
      return;
    }
    deps.showItemInFolder(resolved);
    return;
  }

  // File missing — open the containing directory instead.
  const parent = path.dirname(resolved);
  try {
    await deps.access(parent);
  } catch {
    throw new Error("File and its containing folder no longer exist");
  }

  if (await deps.revealFolder(parent)) {
    return;
  }
  const err = await deps.openPath(parent);
  if (err) {
    throw new Error(`Failed to open folder: ${err}`);
  }
}
