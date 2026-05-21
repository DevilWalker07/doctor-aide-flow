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
        // Permitir precache de bundles >2MB (jspdf/pdfjs vão grandes mesmo split)
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      devOptions: {
        enabled: false, // SW só em build, evita estado estranho em dev
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Split manual de vendor chunks pra browser fazer parallel download
        // e cache funcionar entre deploys (lib não muda = cache vale).
        manualChunks: (id) => {
          if (!id.includes("node_modules")) return undefined;

          // PDF/export: lazy só nas telas que exportam
          if (id.includes("jspdf") || id.includes("html2canvas")) return "vendor-pdf";
          if (id.includes("pdfjs-dist")) return "vendor-pdfjs";
          if (id.includes("docx") || id.includes("mammoth")) return "vendor-docs";

          // UI primitives (radix, embla, lucide são pesados)
          if (id.includes("@radix-ui")) return "vendor-radix";
          if (id.includes("embla-carousel") || id.includes("react-day-picker") || id.includes("react-resizable-panels")) return "vendor-ui-extras";
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("recharts")) return "vendor-charts";

          // Framework — inclui scheduler e jsx-runtime pra evitar circular
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/") ||
            id.includes("react-is") ||
            id.includes("react/jsx-runtime") ||
            id.includes("react/jsx-dev-runtime")
          ) {
            return "vendor-react";
          }
          if (id.includes("@tanstack/react-router") || id.includes("@tanstack/router")) return "vendor-router";

          // Supabase
          if (id.includes("@supabase")) return "vendor-supabase";

          // Date / forms
          if (id.includes("date-fns")) return "vendor-date";
          if (id.includes("react-hook-form") || id.includes("@hookform")) return "vendor-forms";

          // Utils
          if (id.includes("sonner") || id.includes("cmdk") || id.includes("clsx") || id.includes("class-variance-authority") || id.includes("tailwind-merge")) return "vendor-utils";

          // Tudo mais do node_modules vai junto (geralmente pequeno)
          return "vendor-misc";
        },
      },
    },
  },
});
