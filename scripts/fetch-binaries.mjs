#!/usr/bin/env node
// @ts-check
/**
 * Fetch PINNED yt-dlp + static ffmpeg binaries for the HOST platform into the
 * bundled bin dir consumed by electron-forge `extraResource`
 * (`packages/yt-client/resources/bin`).
 *
 * - Downloads yt-dlp from its GitHub release and verifies it against the
 *   published `SHA2-256SUMS` file (yt-dlp signs/publishes per-asset SHA256).
 * - Downloads a static ffmpeg build (BtbN/FFmpeg-Builds) and extracts the
 *   `ffmpeg` binary out of the release archive.
 * - Sets the executable bit (0o755) on Linux.
 * - Node built-ins only (node:https / node:fs / node:crypto / node:path /
 *   node:child_process). No new dependencies.
 *
 * Run with: `npm run binaries:fetch`
 *
 * ─── HOW TO BUMP VERSIONS ────────────────────────────────────────────────
 * yt-dlp:  set YT_DLP_VERSION to a tag from
 *          https://github.com/yt-dlp/yt-dlp/releases (format YYYY.MM.DD).
 *          No hash to update — checksums are pulled live from that release's
 *          SHA2-256SUMS and verified against the downloaded asset.
 * ffmpeg:  set FFMPEG_RELEASE_TAG + FFMPEG_BUILD_SUFFIX to a build from
 *          https://github.com/BtbN/FFmpeg-Builds/releases . BtbN ships a
 *          rolling `latest` tag; we pin the versioned n-branch asset names
 *          (e.g. `ffmpeg-n7.1-latest-win64-gpl-7.1`) for reproducible builds.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { get } from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ─── PINNED VERSIONS ───────────────────────────────────────────────────────
/** yt-dlp release tag — see "HOW TO BUMP" above. */
const YT_DLP_VERSION = "2026.03.17";
/** BtbN/FFmpeg-Builds release tag (rolling). */
const FFMPEG_RELEASE_TAG = "latest";
/** Versioned ffmpeg build suffix, mapped per-platform below. */
const FFMPEG_BUILD = "n7.1-latest";
// ────────────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const BIN_DIR = path.join(
  REPO_ROOT,
  "packages",
  "yt-client",
  "resources",
  "bin",
);

const IS_WINDOWS = process.platform === "win32";
const IS_LINUX = process.platform === "linux";

if (!IS_WINDOWS && !IS_LINUX) {
  fail(
    `Unsupported host platform "${process.platform}". ` +
      "Only win32 and linux are supported (macOS is out of scope).",
  );
}
if (process.arch !== "x64") {
  fail(
    `Unsupported host arch "${process.arch}". Only x64 builds are pinned.`,
  );
}

/** Per-platform asset descriptors. */
const YT_DLP_ASSET = IS_WINDOWS ? "yt-dlp.exe" : "yt-dlp_linux";
const YT_DLP_OUT = IS_WINDOWS ? "yt-dlp.exe" : "yt-dlp";

const FFMPEG_PLATFORM = IS_WINDOWS ? "win64" : "linux64";
const FFMPEG_ARCHIVE = IS_WINDOWS
  ? `ffmpeg-${FFMPEG_BUILD}-${FFMPEG_PLATFORM}-gpl-7.1.zip`
  : `ffmpeg-${FFMPEG_BUILD}-${FFMPEG_PLATFORM}-gpl-7.1.tar.xz`;
const FFMPEG_OUT = IS_WINDOWS ? "ffmpeg.exe" : "ffmpeg";
const FFMPEG_INNER = IS_WINDOWS ? "ffmpeg.exe" : "ffmpeg";

const YT_DLP_BASE = `https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}`;
const FFMPEG_URL = `https://github.com/BtbN/FFmpeg-Builds/releases/download/${FFMPEG_RELEASE_TAG}/${FFMPEG_ARCHIVE}`;

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));

async function main() {
  log(`Host: ${process.platform}/${process.arch}`);
  log(`Target bin dir: ${BIN_DIR}`);
  mkdirSync(BIN_DIR, { recursive: true });

  await fetchYtDlp();
  await fetchFfmpeg();

  log("Done. Bundled binaries are ready.");
}

// ─── yt-dlp ─────────────────────────────────────────────────────────────────

async function fetchYtDlp() {
  log(`Fetching yt-dlp ${YT_DLP_VERSION} (${YT_DLP_ASSET})…`);
  const buf = await download(`${YT_DLP_BASE}/${YT_DLP_ASSET}`);

  log("Fetching SHA2-256SUMS for checksum verification…");
  const sumsText = (await download(`${YT_DLP_BASE}/SHA2-256SUMS`)).toString(
    "utf8",
  );
  const expected = parseSha256Sums(sumsText, YT_DLP_ASSET);
  if (!expected) {
    fail(
      `Could not find a SHA256 entry for "${YT_DLP_ASSET}" in SHA2-256SUMS. ` +
        "Did the asset name change for this release?",
    );
  }
  const actual = createHash("sha256").update(buf).digest("hex");
  if (actual.toLowerCase() !== expected.toLowerCase()) {
    fail(
      `yt-dlp checksum mismatch for ${YT_DLP_ASSET}.\n` +
        `  expected: ${expected}\n  actual:   ${actual}`,
    );
  }
  log("yt-dlp checksum OK.");

  const out = path.join(BIN_DIR, YT_DLP_OUT);
  writeFileSync(out, buf);
  makeExecutable(out);
  log(`Wrote ${out} (${formatBytes(buf.length)})`);
}

/** Parse a `SHA2-256SUMS` body, returning the hex digest for `assetName`. */
function parseSha256Sums(text, assetName) {
  for (const line of text.split(/\r?\n/)) {
    const m = line.trim().match(/^([0-9a-fA-F]{64})\s+\*?(.+)$/);
    if (m && path.basename(m[2].trim()) === assetName) {
      return m[1];
    }
  }
  return null;
}

// ─── ffmpeg ─────────────────────────────────────────────────────────────────

async function fetchFfmpeg() {
  log(`Fetching ffmpeg (${FFMPEG_ARCHIVE})…`);
  const archiveBuf = await download(FFMPEG_URL);

  const tmpDir = path.join(BIN_DIR, `.ffmpeg-tmp-${process.pid}`);
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  const archivePath = path.join(tmpDir, FFMPEG_ARCHIVE);
  writeFileSync(archivePath, archiveBuf);

  try {
    extractArchive(archivePath, tmpDir);
    const ffmpegSrc = findFile(tmpDir, FFMPEG_INNER);
    if (!ffmpegSrc) {
      fail(
        `Could not locate "${FFMPEG_INNER}" inside ${FFMPEG_ARCHIVE}. ` +
          "The archive layout may have changed.",
      );
    }
    const buf = readFileSync(ffmpegSrc);
    const out = path.join(BIN_DIR, FFMPEG_OUT);
    writeFileSync(out, buf);
    makeExecutable(out);
    log(`Wrote ${out} (${formatBytes(buf.length)})`);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Extract a `.zip` (Windows) or `.tar.xz` (Linux) using the host `tar`.
 * bsdtar ships with Windows 10+ and transparently handles `.zip`; GNU tar on
 * Linux handles `.tar.xz` (xz support is standard on modern distros).
 */
function extractArchive(archivePath, destDir) {
  const res = spawnSync("tar", ["-xf", archivePath, "-C", destDir], {
    stdio: "inherit",
  });
  if (res.error) {
    fail(`Failed to run "tar" to extract archive: ${res.error.message}`);
  }
  if (res.status !== 0) {
    fail(
      `Extraction of ${path.basename(archivePath)} failed (exit ${res.status}).`,
    );
  }
}

/** Depth-first search for a file named `name` under `root`. */
function findFile(root, name) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const hit = findFile(full, name);
      if (hit) return hit;
    } else if (entry.name === name) {
      return full;
    }
  }
  return null;
}

// ─── helpers ────────────────────────────────────────────────────────────────

/** GET a URL into a Buffer, following GitHub's redirect to the CDN. */
function download(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) {
      reject(new Error(`Too many redirects fetching ${url}`));
      return;
    }
    get(url, { headers: { "User-Agent": "yt-hub-fetch-binaries" } }, (res) => {
      const { statusCode = 0, headers } = res;
      if (statusCode >= 300 && statusCode < 400 && headers.location) {
        res.resume();
        resolve(download(headers.location, redirects + 1));
        return;
      }
      if (statusCode !== 200) {
        res.resume();
        reject(new Error(`GET ${url} → HTTP ${statusCode}`));
        return;
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

function makeExecutable(file) {
  if (IS_LINUX) {
    chmodSync(file, 0o755);
  }
}

function formatBytes(n) {
  return n >= 1 << 20
    ? `${(n / (1 << 20)).toFixed(1)} MiB`
    : `${(n / 1024).toFixed(1)} KiB`;
}

function log(msg) {
  process.stdout.write(`[fetch-binaries] ${msg}\n`);
}

/** Print a clear error and exit non-zero. */
function fail(msg) {
  process.stderr.write(`[fetch-binaries] ERROR: ${msg}\n`);
  process.exit(1);
}
