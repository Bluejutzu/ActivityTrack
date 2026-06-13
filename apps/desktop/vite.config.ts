import { defineConfig } from "vite";

// Tauri serves this frontend from a fixed port in dev and from bundled assets
// in release. Keep the config minimal — the UI is a tiny status/debug panel.
export default defineConfig({
  clearScreen: false,
  server: {
    port: 5174,
    strictPort: true,
  },
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
  },
});
