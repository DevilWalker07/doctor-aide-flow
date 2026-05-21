import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    react(),
    tsconfigPaths(),
    tailwindcss(),
    VitePWA({
      // Auto-atualiza o SW quando há nova versão
      registerType: "autoUpdate",
      // Usa o manifest que já existe em public/
      manifest: false,
      includeAssets: ["favicon.svg", "icon.svg", "icon-maskable.svg", "manifest.webmanifest"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,ico,woff2}"],
        // Edge functions e API calls não devem ser cacheadas (sempre fresh)
        navigateFallbackDenylist: [
          /^\/functions\/v1\//,
          /^\/api\//,
        ],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
        // Edge functions Supabase nunca em cache (já são dinâmicas)
        navigateFallback: null,
      },
      devOptions: {
        enabled: false, // SW só em build, evita estado estranho em dev
      },
    }),
  ],
});
