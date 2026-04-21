import { createHash, randomBytes } from "node:crypto";

/**
 * ASCII-only basename for on-disk storage (no Unicode / platform quirks).
 * Random salt makes each attempt unique so re-downloads never collide.
 */
export function buildStorageStem(
  link: string,
  format: string,
  humanLabel: string,
): string {
  const salt = randomBytes(16).toString("hex");
  return createHash("sha256")
    .update(`${link}\0${format}\0${humanLabel}\0${salt}`, "utf8")
    .digest("hex")
    .slice(0, 32);
}
