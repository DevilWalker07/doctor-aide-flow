import { expect, type Page } from "@playwright/test";

export const withSupabase = Boolean(process.env.E2E_SUPABASE_URL && process.env.E2E_SUPABASE_ANON_KEY);

export function uniqueEmail() {
  return `e2e+${Date.now()}${Math.floor(Math.random() * 1000)}@test.local`;
}

/**
 * Com Supabase local (E2E_SUPABASE_*): cria conta e entra pela UI.
 * Sem Supabase: o app roda em modo local (sem login) e nada precisa ser feito.
 */
export async function ensureSession(page: Page): Promise<{ email: string | null }> {
  if (!withSupabase) return { email: null };
  const email = uniqueEmail();
  await page.goto("/cadastro");
  await page.getByTestId("auth-name").fill("MÉDICO E2E");
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-password").fill("senha-forte-123");
  await page.getByTestId("auth-password-confirm").fill("senha-forte-123");
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL(/\/dashboard|\/$/);
  return { email };
}

export async function seedDoctor(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("da_nome_medico", "MÉDICO E2E");
    localStorage.setItem("da_crm", "99999-BA");
    localStorage.setItem("da_especialidade", "CLÍNICA MÉDICA");
    localStorage.setItem("da_hospital_padrao", "HOSPITAL E2E");
  });
}
