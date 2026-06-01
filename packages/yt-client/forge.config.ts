import { existsSync } from "node:fs";
import path from "node:path";
import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import type { ForgeConfig } from "@electron-forge/shared-types";

// Bundled yt-dlp/ffmpeg live here, fetched via `npm run binaries:fetch`.
// The folder is literally named `bin` so electron-forge `extraResource`
// copies it to `<resourcesPath>/bin`, which is exactly where
// BundledBinaryResolver looks (`path.join(process.resourcesPath, "bin")`).
// These binaries are gitignored, so the dir is absent in CI/fresh clones;
// forge errors on a missing extraResource path, so we add it only when present.
const BIN_DIR = path.join(__dirname, "resources", "bin");

const config: ForgeConfig = {
  packagerConfig: {
    name: "YT Hub",
    icon: "./assets/icon",
    extraResource: [
      "./assets/icon.png",
      ...(existsSync(BIN_DIR) ? [BIN_DIR] : []),
    ],
    asar: true,
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
