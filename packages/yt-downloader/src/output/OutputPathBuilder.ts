import { extname, resolve } from "node:path";

/**
 * Windows forbids `\\ / : * ? " < > |`. Titles often use fullwidth homoglyphs (e.g. U+FF0F ／)
 * that yt-dlp/ffmpeg may normalize differently, so the file on disk won't match `output_path`.
 */
const UNSAFE_FILENAME_CHARS =
  /[/\\:*?"<>|\uFF0F\uFF3C\uFF1A\uFF02\uFF1C\uFF1D\uFF1F\uFF5C\uFF0A\u2215\u2044]/g;

/** Whole basename `stem[_nnn].ext` must stay under Rust/API limits and typical Windows component limits. */
const MAX_OUTPUT_FILENAME_UTF8_BYTES = 196;
/** Room for `_999` before the extension when resolving collisions. */
const RESERVED_COLLISION_UTF8_BYTES = 6;

/** Truncate so UTF-8 byte length ≤ maxBytes without splitting code points. */
export function truncateUtf8Bytes(s: string, maxBytes: number): string {
  if (maxBytes <= 0) return "";
  const enc = new TextEncoder();
  let out = "";
  for (const ch of s) {
    const next = out + ch;
    if (enc.encode(next).length > maxBytes) break;
    out = next;
  }
  return out;
}

function maxStemUtf8Bytes(formatId: string): number {
  const extPart = 1 + formatId.length; // `.` + mp3/mp4
  return Math.max(
    8,
    MAX_OUTPUT_FILENAME_UTF8_BYTES - RESERVED_COLLISION_UTF8_BYTES - extPart,
  );
}

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
  return result || "download";
}

const STORAGE_STEM_RE = /^[a-f0-9]{32}$/;

export class OutputPathBuilder {
  /**
   * Output path using a precomputed storage stem (see `buildStorageStem`).
   * Filename on disk: `{stem}.mp4` or `{stem}_{n}.mp4` when avoiding collisions.
   */
  buildStorage(
    stem: string,
    formatId: string,
    destination: string,
    exists?: (path: string) => boolean,
  ): string {
    if (!STORAGE_STEM_RE.test(stem)) {
      throw new Error(
        "Invalid storage stem: expected 32 lowercase hex characters",
      );
    }

    const resolvedDestination = resolve(destination);
    const ext = `.${formatId}`;
    let candidate = resolve(resolvedDestination, `${stem}${ext}`);

    if (!candidate.startsWith(resolvedDestination)) {
      throw new Error("Path traversal detected");
    }

    if (exists) {
      let suffix = 1;
      while (exists(candidate) && suffix <= 999) {
        candidate = resolve(resolvedDestination, `${stem}_${suffix}${ext}`);
        suffix++;
      }
    }

    return candidate;
  }

  /**
   * @deprecated Prefer `buildStorage` + `buildStorageStem` for downloads; kept for tests / tooling.
   */
  build(
    name: string,
    formatId: string,
    destination: string,
    exists?: (path: string) => boolean,
  ): string {
    const sanitized = sanitizeFilename(name);
    const baseNameRaw = extname(sanitized)
      ? sanitized.slice(0, -extname(sanitized).length)
      : sanitized;
    const stemLimit = maxStemUtf8Bytes(formatId);
    let baseName = truncateUtf8Bytes(baseNameRaw, stemLimit);
    if (!baseName) baseName = "download";

    const resolvedDestination = resolve(destination);
    const ext = `.${formatId}`;
    let candidate = resolve(destination, `${baseName}${ext}`);

    if (!candidate.startsWith(resolvedDestination)) {
      throw new Error("Path traversal detected");
    }

    if (exists) {
      let suffix = 1;
      while (exists(candidate) && suffix <= 999) {
        candidate = resolve(destination, `${baseName}_${suffix}${ext}`);
        suffix++;
      }
    }

    return candidate;
  }
}
