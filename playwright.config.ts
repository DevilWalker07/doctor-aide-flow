import { defineConfig, devices } from "@playwright/test";

const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.E2E_SUPABASE_ANON_KEY ?? "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? "";
const withSupabase = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY);

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

/**
 * `E2E_SUPABASE_MUDO=1`: o app aponta para um Supabase que nunca responde
 * (`e2e/helpers/supabaseMudo.mjs`) — como a produção em 10/2026. O plantão
 * tem de funcionar assim mesmo.
 */
const mudo = process.env.E2E_SUPABASE_MUDO === "1";
const SUPABASE_MUDO = "http://127.0.0.1:54399";

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    ...(mudo
      ? [
          {
            command: "node e2e/helpers/supabaseMudo.mjs",
            url: `${SUPABASE_MUDO}/__pronto`,
            reuseExistingServer: false,
            timeout: 10_000,
          },
        ]
      : []),
    {
      command: "npx tsx server/index.ts",
      url: "http://localhost:8787/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        PORT: "8787",
        AI_MOCK: "1",
        NODE_ENV: "test",
        ...(mudo
          ? {
              SUPABASE_URL: SUPABASE_MUDO,
              SUPABASE_SERVICE_ROLE_KEY: "chave-de-teste",
              AUTH_OPTIONAL: "true",
            }
          : withSupabase
            ? { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AUTH_OPTIONAL: "false" }
            : { AUTH_OPTIONAL: "true" }),
      },
    },
    {
      command: "npx vite dev --port 5173 --strictPort",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        VITE_CLINICAL_AGENTS_URL: "",
        ...(mudo
          ? { VITE_SUPABASE_URL: SUPABASE_MUDO, VITE_SUPABASE_ANON_KEY: "anon-de-teste" }
          : withSupabase
            ? { VITE_SUPABASE_URL: SUPABASE_URL, VITE_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY }
            : { VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "" }),
      },
    },
  ],
});
