import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import { VitePWA } from "vite-plugin-pwa";

const BACKEND = process.env.VITE_DEV_BACKEND_URL || "http://localhost:8787";

export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    react(),
    tsconfigPaths(),
    tailwindcss(),
    // App instalável que abre sem internet: a sala vermelha costuma não ter
    // sinal, e a emergência pediátrica roda toda no aparelho. O service worker
    // guarda o app (HTML, JS, CSS, ícones) e NUNCA a API — /api e /health vão
    // sempre à rede, então dado clínico nunca sai de um cache velho.
    // `autoUpdate` troca a versão em silêncio, sem recarregar a página: uma
    // atualização não pode interromper uma RCP em andamento.
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "script-defer",
      includeAssets: ["logo.png", "icones/apple-touch-icon.png"],
      manifest: {
        name: "Medfluxo",
        short_name: "Medfluxo",
        description:
          "Assistente clínico para o plantão: documentos, passagem e emergência pediátrica.",
        lang: "pt-BR",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#F4F7FB",
        theme_color: "#0B1F44",
        icons: [
          { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icones/icone-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          {
            name: "Emergência pediátrica",
            short_name: "Emergência",
            url: "/emergencia-pediatrica",
            icons: [{ src: "/icones/icone-192.png", sizes: "192x192" }],
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,woff2,webmanifest}"],
        // o bundle principal e o pdf.js passam do limite padrão de 2 MB
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/health/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  // A passagem carrega estas sob demanda. Sem declarar, o Vite de dev as
  // descobre no primeiro uso e recarrega a página — levando junto os arquivos
  // que o médico acabou de escolher.
  optimizeDeps: {
    include: ["mammoth/mammoth.browser.js", "pdfjs-dist/legacy/build/pdf.mjs", "docx", "jszip"],
  },
  server: {
    proxy: {
      "/api": { target: BACKEND, changeOrigin: true },
      "/health": { target: BACKEND, changeOrigin: true },
    },
  },
});
