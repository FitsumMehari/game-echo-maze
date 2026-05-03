import { defineConfig } from "vite";

/** GitHub Pages project URL is /<repo-name>/ when not using a custom domain */
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  build: {
    chunkSizeWarningLimit: 900,
  },
});
