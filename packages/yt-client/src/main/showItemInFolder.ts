import path from "node:path";

export interface ShowItemInFolderDeps {
  access: (p: string) => Promise<void>;
  /**
   * Open the given folder in the registered GUI file manager (ShowFolders via
   * D-Bus on Linux). Returns true if handled. ShowFolders opens that exact
   * folder, unlike ShowItems whose "parent of the file" resolution is
   * unreliable across file managers.
   */
  openFolderInFileManager: (folder: string) => Promise<boolean>;
  /** Native reveal that highlights the file (Explorer/Finder on Windows/macOS). */
  showItemNative: (p: string) => void;
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
  const folder = path.dirname(resolved);

  let fileExists = true;
  try {
    await deps.access(resolved);
  } catch {
    fileExists = false;
  }

  let folderExists = fileExists;
  if (!folderExists) {
    try {
      await deps.access(folder);
      folderExists = true;
    } catch {
      folderExists = false;
    }
  }

  if (!fileExists && !folderExists) {
    throw new Error("File and its containing folder no longer exist");
  }

  // Open the exact containing folder in the GUI file manager (reliable on Linux).
  if (folderExists && (await deps.openFolderInFileManager(folder))) {
    return;
  }

  // Native: highlight the file on Windows/macOS (where this works correctly).
  if (fileExists) {
    deps.showItemNative(resolved);
    return;
  }

  // Last resort: open the folder via the OS default handler.
  const err = await deps.openPath(folder);
  if (err) {
    throw new Error(`Failed to open folder: ${err}`);
  }
}
