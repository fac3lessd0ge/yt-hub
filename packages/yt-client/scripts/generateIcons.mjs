import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import png2icons from "png2icons";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(here, "..", "assets");

const svg = await readFile(resolve(assetsDir, "icon.svg"));

const png = await sharp(svg).resize(1024, 1024).png().toBuffer();
await writeFile(resolve(assetsDir, "icon.png"), png);

const icns = png2icons.createICNS(png, png2icons.BICUBIC, 0);
if (!icns) throw new Error("Failed to generate icon.icns");
await writeFile(resolve(assetsDir, "icon.icns"), icns);

const ico = png2icons.createICO(png, png2icons.BICUBIC, 0, false, true);
if (!ico) throw new Error("Failed to generate icon.ico");
await writeFile(resolve(assetsDir, "icon.ico"), ico);

console.log("Generated icon.png (1024x1024), icon.icns, icon.ico in", assetsDir);
