import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri serves this frontend from a fixed port in dev and from bundled assets
// in release. Keep the config minimal — the UI is a tiny status/debug panel.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5174,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
  },
});
