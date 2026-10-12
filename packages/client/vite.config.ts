import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "cards/*.svg"],
      manifest: {
        name: "Brisca 3D Royale",
        short_name: "Brisca 3D",
        description:
          "Juego de Brisca Española en 3D Online para 2 jugadores con estética Arcade Balatro",
        theme_color: "#0c0e14",
        background_color: "#0c0e14",
        display: "standalone",
        orientation: "any",
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
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  server: {
    port: 3000,
  },
});
