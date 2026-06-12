import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config — testes E2E do Doutor Ajuda.
 *
 * Roda contra o dev server do Vite (npm run dev na porta 5173).
 * Todas as chamadas HTTP pra Supabase Edge Functions são interceptadas
 * via page.route() em cada spec — testes são determinísticos, não dependem
 * de gpt-5 nem de conexão real.
 *
 * Pra rodar localmente: npm run test:e2e (ou npm run test:e2e:ui pra UI mode).
 * No CI: roda 1 worker, headless, com a porta 5173 do dev server.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // mantém ordem previsível, mais fácil de debugar
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000, // primeira nav pode esperar Vite compilar
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Viewport de iPhone 14 com engine chromium — não precisamos do WebKit real
      // pra testes funcionais e o CI só instala um browser pra ser rápido.
      name: "mobile-chromium",
      use: {
        ...devices["iPhone 14"],
        browserName: "chromium",
        defaultBrowserType: "chromium",
      },
    },
  ],

  webServer: {
    command: "npx vite dev --port 5173 --host 127.0.0.1",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
