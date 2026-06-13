import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  clean: true,
  minify: true,
  // koffi loads a prebuilt native .node at runtime; keep it external and ship
  // it next to the bundle (the installer copies node_modules/koffi/build).
  external: ["koffi"],
});
