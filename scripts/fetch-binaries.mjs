import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { download, verifySha256 } from "./lib/binary-download.mjs";

// Update binaries.json with upstream hashes for both platforms. FFmpeg daily
// releases expire; month-end builds are retained for two years. Never use latest.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const binDir = path.join(root, "packages/yt-client/resources/bin");
const manifest = JSON.parse(
  readFileSync(new URL("./binaries.json", import.meta.url), "utf8"),
);

async function main() {
  const assets = manifest[process.platform];
  if (!assets || process.arch !== "x64")
    throw new Error(
      `Unsupported platform ${process.platform}/${process.arch}; expected win32/linux x64`,
    );
  mkdirSync(binDir, { recursive: true });
  const staging = mkdtempSync(path.join(binDir, ".fetch-"));
  const ready = [];
  try {
    for (const [index, asset] of assets.entries()) {
      console.log(`[fetch-binaries] Fetching ${asset.name}`);
      const bytes = await download(asset.url);
      verifySha256(bytes, asset.sha256, asset.name);
      console.log(`[fetch-binaries] ${asset.name}: SHA256 OK`);
      const assetDir = path.join(staging, String(index));
      mkdirSync(assetDir);
      const downloaded = path.join(
        assetDir,
        path.basename(new URL(asset.url).pathname),
      );
      writeFileSync(downloaded, bytes);
      if (asset.archive) {
        // GNU tar cannot unpack Deno's ZIP. Windows' bsdtar can.
        const isLinuxZip =
          process.platform === "linux" && downloaded.endsWith(".zip");
        const tool = isLinuxZip ? "unzip" : "tar";
        const args = isLinuxZip
          ? ["-q", downloaded, "-d", assetDir]
          : ["-xf", downloaded, "-C", assetDir];
        const result = spawnSync(tool, args, { stdio: "inherit" });
        if (result.error || result.status !== 0)
          throw new Error(
            `Cannot extract ${asset.name} with ${tool}: ${result.error?.message ?? result.status}`,
          );
      }
      for (const name of asset.files) {
        const source = asset.archive ? findFile(assetDir, name) : downloaded;
        if (!source) throw new Error(`${name} missing from ${asset.name}`);
        ready.push({ source, name });
      }
    }
    // Do not replace existing binaries until all downloads and hashes pass.
    for (const { source, name } of ready) {
      const destination = path.join(binDir, name);
      copyFileSync(source, destination);
      if (process.platform === "linux") chmodSync(destination, 0o755);
    }
    console.log(
      `[fetch-binaries] Ready: ${ready.map(({ name }) => name).join(", ")}`,
    );
  } finally {
    // mkdtemp creates this unique directory inside the project's binDir only.
    rmSync(staging, { recursive: true, force: true });
  }
}
function findFile(directory, name) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isFile() && entry.name === name) return candidate;
    if (entry.isDirectory()) {
      const found = findFile(candidate, name);
      if (found) return found;
    }
  }
  return null;
}
main().catch((error) => {
  console.error(`[fetch-binaries] ${error.message}`);
  process.exitCode = 1;
});
