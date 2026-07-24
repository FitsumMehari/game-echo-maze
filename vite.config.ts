import { defineConfig } from "vite";
import path from "node:path";
import { VitePWA } from "vite-plugin-pwa";

/** GitHub Pages project URL is /<repo-name>/ when not using a custom domain */
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: ["favicon.svg", "icons.svg"],
      manifest: {
        name: "Echo Maze Overdrive",
        short_name: "Echo Maze",
        description: "First-person sonar stealth — sound maps the maze and feeds the hunters.",
        theme_color: "#06050c",
        background_color: "#06050c",
        display: "standalone",
        start_url: "./",
        icons: [
          {
            src: "favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
        navigateFallback: "index.html",
      },
    }),
  ],
});
