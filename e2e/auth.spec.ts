import { test, expect } from "@playwright/test";
import { mockEdgeFunctions } from "./fixtures/mock-edge";

/**
 * Testes do fluxo de autenticação: telas de login/cadastro/nova-senha
 * renderizam, validam input e chamam Supabase Auth corretamente.
 *
 * Intercepta as chamadas /auth/v1/* do Supabase pra não bater no servidor
 * real e ter respostas determinísticas.
 *
 * Não usa seedLocalUser pra simular usuário deslogado.
 */

async function mockSupabaseAuth(page: import("@playwright/test").Page, opts: {
  signupOk?: boolean;
  signinOk?: boolean;
  resetOk?: boolean;
}) {
  await page.route(/\/auth\/v1\/signup/, async (route) => {
    if (opts.signupOk === false) {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error_code: "user_already_exists", msg: "User already registered" }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: { id: "new-user", email: "novo@medico.com", user_metadata: { name: "Dr. Novo" } },
          session: { access_token: "tok", refresh_token: "ref", expires_in: 3600 },
        }),
      });
    }
  });

  await page.route(/\/auth\/v1\/token\?grant_type=password/, async (route) => {
    if (opts.signinOk === false) {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error_code: "invalid_credentials", msg: "Invalid login credentials" }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: { id: "existing-user", email: "medico@hospital.com", user_metadata: { name: "Dr. Medico" } },
          access_token: "tok",
          refresh_token: "ref",
          expires_in: 3600,
        }),
      });
    }
  });

  await page.route(/\/auth\/v1\/recover/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });
}

test.describe("/login — fluxo de entrada", () => {
  // Sobrescreve VITE_E2E pra forçar caminho real de auth nesses testes
  test.beforeEach(async ({ page }) => {
    // Não usa seedLocalUser — testa como usuário novo
    await page.addInitScript(() => {
      // Limpa qualquer sessão residual
      localStorage.removeItem("da_local_user_id");
      localStorage.removeItem("da_local_user_name");
    });
  });

  test("renderiza com email, senha e botão Google", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: /doutor ajuda/i })).toBeVisible();
    await expect(page.getByPlaceholder(/seu@email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/••••••••/)).toBeVisible();
    await expect(page.getByRole("button", { name: /continuar com google/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^entrar$/i })).toBeVisible();
  });

  test("botão Entrar desabilitado sem email ou senha", async ({ page }) => {
    await page.goto("/login");
    const submitBtn = page.getByRole("button", { name: /^entrar$/i });
    await expect(submitBtn).toBeDisabled();

    await page.getByPlaceholder(/seu@email/i).fill("medico@hospital.com");
    await expect(submitBtn).toBeDisabled();

    await page.getByPlaceholder(/••••••••/).fill("senha123");
    await expect(submitBtn).toBeEnabled();
  });

  test("mostra erro pt-BR quando credenciais inválidas", async ({ page }) => {
    await mockSupabaseAuth(page, { signinOk: false });
    await page.goto("/login");

    await page.getByPlaceholder(/seu@email/i).fill("errado@hospital.com");
    await page.getByPlaceholder(/••••••••/).fill("senhaErrada");
    await page.getByRole("button", { name: /^entrar$/i }).click();

    await expect(page.getByText(/email ou senha incorretos/i)).toBeVisible({ timeout: 8_000 });
  });

  test("link 'Cadastrar' navega pra /cadastro", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /^cadastrar$/i }).click();
    await expect(page).toHaveURL(/\/cadastro$/);
  });

  test("link 'Esqueci minha senha' navega pra /nova-senha", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /esqueci minha senha/i }).click();
    await expect(page).toHaveURL(/\/nova-senha$/);
  });
});

test.describe("/cadastro — criação de conta", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("da_local_user_id");
    });
  });

  test("renderiza com 3 campos (nome, email, senha) e botão Google", async ({ page }) => {
    await page.goto("/cadastro");
    await expect(page.getByRole("heading", { name: /criar conta/i })).toBeVisible();
    await expect(page.getByPlaceholder(/dr\. luan carvalho/i)).toBeVisible();
    await expect(page.getByPlaceholder(/seu@email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/••••••••/)).toBeVisible();
    await expect(page.getByRole("button", { name: /continuar com google/i })).toBeVisible();
  });

  test("mostra erro 'pelo menos 6 caracteres' em senha curta", async ({ page }) => {
    await page.goto("/cadastro");
    await page.getByPlaceholder(/seu@email/i).fill("novo@medico.com");
    await page.getByPlaceholder(/••••••••/).fill("123");
    await expect(page.getByText(/pelo menos 6 caracteres/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /criar conta/i })).toBeDisabled();
  });

  test("mostra erro pt-BR quando email já existe", async ({ page }) => {
    await mockSupabaseAuth(page, { signupOk: false });
    await page.goto("/cadastro");

    await page.getByPlaceholder(/dr\. luan carvalho/i).fill("Dr. Teste");
    await page.getByPlaceholder(/seu@email/i).fill("existente@hospital.com");
    await page.getByPlaceholder(/••••••••/).fill("senha123");
    await page.getByRole("button", { name: /criar conta/i }).click();

    await expect(page.getByText(/este email já tem conta/i)).toBeVisible({ timeout: 8_000 });
  });
});

test.describe("/nova-senha — solicitar reset", () => {
  test("formulário envia email e mostra confirmação", async ({ page }) => {
    await mockSupabaseAuth(page, { resetOk: true });
    await page.goto("/nova-senha");

    await expect(page.getByRole("heading", { name: /esqueceu a senha/i })).toBeVisible();

    await page.getByPlaceholder(/seu@email/i).fill("medico@hospital.com");
    await page.getByRole("button", { name: /enviar link/i }).click();

    await expect(page.getByText(/email enviado/i)).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/verifique sua caixa de entrada/i)).toBeVisible();
  });
});
