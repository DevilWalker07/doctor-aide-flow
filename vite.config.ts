import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

const BACKEND = process.env.VITE_DEV_BACKEND_URL || "http://localhost:8787";

export default defineConfig({
  plugins: [TanStackRouterVite(), react(), tsconfigPaths(), tailwindcss()],
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
