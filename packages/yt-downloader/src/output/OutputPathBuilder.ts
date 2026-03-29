import { extname, resolve } from "node:path";

const UNSAFE_FILENAME_CHARS = /[/\\:*?"<>|]/g;

function isControlChar(code: number): boolean {
  return (
    (code >= 0x00 && code <= 0x1f) ||
    code === 0x7f ||
    (code >= 0x80 && code <= 0x9f)
  );
}

export function sanitizeFilename(name: string): string {
  let result = name.trim();
  result = result.replace(UNSAFE_FILENAME_CHARS, "_");
  result = Array.from(result)
    .filter((ch) => !isControlChar(ch.charCodeAt(0)))
    .join("");
  result = result.replace(/_+/g, "_");
  result = result.replace(/^\.+/, "");
  result = result.replace(/[. ]+$/, "");
  result = result.slice(0, 200);
  return result || "download";
}

export class OutputPathBuilder {
  build(name: string, formatId: string, destination: string): string {
    const sanitized = sanitizeFilename(name);
    const baseName = extname(sanitized)
      ? sanitized.slice(0, -extname(sanitized).length)
      : sanitized;
    const fullPath = resolve(destination, `${baseName}.${formatId}`);

    const resolvedDestination = resolve(destination);
    if (!fullPath.startsWith(resolvedDestination)) {
      throw new Error("Path traversal detected");
    }

    return fullPath;
  }
}
