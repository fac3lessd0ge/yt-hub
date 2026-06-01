import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/schemas.ts", "src/source/index.ts"],
  format: ["esm"],
  dts: true,
  outDir: "dist",
  clean: true,
  sourcemap: true,
});
