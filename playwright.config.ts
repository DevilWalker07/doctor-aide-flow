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
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 14"] },
    },
  ],

  webServer: {
    command: "npm run dev -- --port 5173",
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
