import path from "node:path";

export interface ShowItemInFolderDeps {
  access: (p: string) => Promise<void>;
  showItemInFolder: (p: string) => void;
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

  try {
    await deps.access(resolved);
    deps.showItemInFolder(resolved);
    return;
  } catch {
    // File missing — fall back to opening the containing directory.
  }

  const parent = path.dirname(resolved);
  try {
    await deps.access(parent);
  } catch {
    throw new Error("File and its containing folder no longer exist");
  }

  const err = await deps.openPath(parent);
  if (err) {
    throw new Error(`Failed to open folder: ${err}`);
  }
}
