import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import process from "node:process";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": "/src" } },
  // Desktop app: the bundle loads from disk, so the web-oriented 500 kB warning does not apply.
  build: { chunkSizeWarningLimit: 1024 },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    // Browser-only dev preview: stands in for plugin-http, which only exists inside Tauri.
    proxy: {
      "/proxy/deezer": { target: "https://api.deezer.com", changeOrigin: true, rewrite: (p: string) => p.replace(/^\/proxy\/deezer/, "") },
      "/proxy/itunes": { target: "https://itunes.apple.com", changeOrigin: true, rewrite: (p: string) => p.replace(/^\/proxy\/itunes/, "") },
      "/proxy/lrclib": { target: "https://lrclib.net", changeOrigin: true, rewrite: (p: string) => p.replace(/^\/proxy\/lrclib/, "") },
      "/proxy/mymemory": { target: "https://api.mymemory.translated.net", changeOrigin: true, rewrite: (p: string) => p.replace(/^\/proxy\/mymemory/, "") },
    },
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
