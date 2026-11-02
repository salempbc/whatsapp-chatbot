import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  root: "web",
  publicDir: "../public",
  plugins: [vue()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    sourcemap: false
  },
  server: {
    proxy: { "/api": "http://localhost:3000", "/ping": "http://localhost:3000" }
  }
});
