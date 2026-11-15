import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { verifySha256 } from "../lib/binary-download.mjs";

const hash = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
test("accepts verified bytes and rejects a modified artifact", () => {
  verifySha256(Buffer.from("abc"), hash.toUpperCase(), "fixture");
  assert.throws(
    () => verifySha256(Buffer.from("abd"), hash, "fixture"),
    /SHA256 mismatch/,
  );
  assert.throws(
    () => verifySha256(Buffer.from("abc"), "", "fixture"),
    /SHA256 mismatch/,
  );
});
test("both release platforms pin every bundled dependency", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../binaries.json", import.meta.url), "utf8"),
  );
  for (const platform of ["win32", "linux"]) {
    const names = [];
    for (const asset of manifest[platform]) {
      assert.match(
        asset.url,
        /^https:\/\/github.com\/[^/]+\/[^/]+\/releases\/download\//,
      );
      assert.ok(!asset.url.includes("/latest/"));
      assert.match(asset.sha256, /^[a-f0-9]{64}$/);
      names.push(...asset.files.map((name) => name.replace(/\.exe$/, "")));
    }
    assert.deepEqual(names.sort(), ["deno", "ffmpeg", "ffprobe", "yt-dlp"]);
  }
});
