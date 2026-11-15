import { existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import type { ForgeConfig } from "@electron-forge/shared-types";

// Bundled executables live here, fetched via `npm run binaries:fetch`.
// The folder is literally named `bin` so electron-forge `extraResource`
// copies it to `<resourcesPath>/bin`, which is exactly where
// BundledBinaryResolver looks (`path.join(process.resourcesPath, "bin")`).
// prePackage rejects incomplete bundles with a setup hint for fresh clones.
const BIN_DIR = path.join(__dirname, "resources", "bin");

const config: ForgeConfig = {
  packagerConfig: {
    name: "YT Hub",
    icon: path.join(__dirname, "assets/icon"),
    extraResource: [
      path.join(__dirname, "assets/icon.png"),
      ...(existsSync(BIN_DIR) ? [BIN_DIR] : []),
    ],
    asar: true,
    // Strip Chromium's ~55 locale packs down to en-US (~45 MB saved). The app
    // is English-only, so the rest are dead weight.
    afterExtract: [
      ({ buildPath }) => {
        const localesDir = path.join(buildPath, "locales");
        try {
          for (const file of readdirSync(localesDir)) {
            if (file !== "en-US.pak") {
              rmSync(path.join(localesDir, file), { force: true });
            }
          }
        } catch {
          // No locales dir on this platform/layout — nothing to trim.
        }
      },
    ],
  },
  hooks: {
    prePackage: async () => {
      const suffix = process.platform === "win32" ? ".exe" : "";
      for (const binary of ["yt-dlp", "ffmpeg", "ffprobe", "deno"]) {
        if (!existsSync(path.join(BIN_DIR, `${binary}${suffix}`))) {
          throw new Error(
            `Missing bundled ${binary}. Run npm run binaries:fetch before packaging.`,
          );
        }
      }
    },
  },
  makers: [new MakerSquirrel({}), new MakerZIP({}, ["linux"])],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "src/main.ts",
          config: "vite.main.config.mts",
          target: "main",
        },
        {
          entry: "src/preload.ts",
          config: "vite.preload.config.mts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.mts",
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
