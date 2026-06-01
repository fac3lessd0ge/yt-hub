import { execFile } from "node:child_process";
import { pathToFileURL } from "node:url";

type FileManagerMethod = "ShowItems" | "ShowFolders";

/** gdbus argv for an org.freedesktop.FileManager1 call against a single URI. */
export function fileManagerGdbusArgs(
  method: FileManagerMethod,
  uri: string,
): string[] {
  return [
    "call",
    "--session",
    "--dest",
    "org.freedesktop.FileManager1",
    "--object-path",
    "/org/freedesktop/FileManager1",
    "--method",
    `org.freedesktop.FileManager1.${method}`,
    `["${uri}"]`,
    "",
  ];
}

/**
 * Reveal a path in the desktop's registered GUI file manager via the
 * `org.freedesktop.FileManager1` D-Bus interface — `ShowItems` highlights a
 * file inside its folder, `ShowFolders` opens a folder.
 *
 * Linux only; returns `false` if the call fails (no FileManager1 service,
 * `gdbus` missing, timeout) so the caller can fall back. We use this instead of
 * `xdg-open`, which honours the `inode/directory` association — often a terminal
 * — rather than opening an actual file manager.
 */
export function openInFileManager(
  method: FileManagerMethod,
  targetPath: string,
): Promise<boolean> {
  if (process.platform !== "linux") {
    return Promise.resolve(false);
  }
  // pathToFileURL percent-encodes spaces, quotes, and unicode, so the URI is
  // safe to embed in the GVariant string literal passed to gdbus.
  const uri = pathToFileURL(targetPath).href;
  return new Promise((resolve) => {
    execFile(
      "gdbus",
      fileManagerGdbusArgs(method, uri),
      { timeout: 5000 },
      (err) => resolve(!err),
    );
  });
}
