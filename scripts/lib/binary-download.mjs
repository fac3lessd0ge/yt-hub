import { createHash } from "node:crypto";
import { get } from "node:https";
export function verifySha256(bytes, expected, name) {
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (!/^[a-f0-9]{64}$/i.test(expected) || actual !== expected.toLowerCase())
    throw new Error(
      `SHA256 mismatch for ${name}: expected ${expected}, got ${actual}`,
    );
}
export function download(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5 || new URL(url).protocol !== "https:") {
      reject(new Error(`Invalid download redirect: ${url}`));
      return;
    }
    const request = get(
      url,
      { headers: { "User-Agent": "yt-hub-fetch-binaries" } },
      (response) => {
        const { statusCode, headers } = response;
        if (statusCode >= 300 && statusCode < 400 && headers.location) {
          response.resume();
          resolve(download(new URL(headers.location, url).href, redirects + 1));
          return;
        }
        if (statusCode !== 200) {
          response.resume();
          reject(new Error(`GET ${url}: HTTP ${statusCode}`));
          return;
        }
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve(Buffer.concat(chunks)));
        response.on("error", reject);
        response.on("aborted", () =>
          reject(new Error(`Download interrupted: ${url}`)),
        );
      },
    );
    request.setTimeout(60_000, () =>
      request.destroy(new Error(`Download stalled: ${url}`)),
    );
    request.on("error", reject);
  });
}
