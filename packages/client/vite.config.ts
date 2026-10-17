import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon-32.png", "apple-touch-icon.png", "config.json"],
      manifest: {
        name: "Brisca 3D Royale",
        short_name: "Brisca 3D",
        description:
          "Juego de Brisca Española en 3D Online para 2 jugadores con estética Arcade Balatro",
        lang: "es",
        theme_color: "#0c0e14",
        background_color: "#0c0e14",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,webmanifest}"],
        globIgnores: ["_worker.js", "sw.js", "workbox-*.js"],
        runtimeCaching: [
          {
            urlPattern: /\/cards\/.*\.webp(?:\?.*)?$/,
            handler: "CacheFirst",
            options: {
              cacheName: "brisca-cards",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
  },
});
