import { expect, test } from "@playwright/test";
import { ensureSession, seedDoctor } from "./helpers/auth";

test.describe("hub de ambientes", () => {
  test.beforeEach(async ({ page }) => {
    await seedDoctor(page);
    await ensureSession(page);
  });

  test("leva de um subambiente pronto ao início de plantão, com o ambiente já escolhido", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByTestId("hub-ambiente-enfermaria")).toBeVisible();
    await page.getByTestId("hub-sub-clinica-medica").click();

    // O chip vai direto ao destino: /ambiente/:id/:sub redireciona para o
    // início de plantão em vez de parar numa tela intermediária.
    await expect(page).toHaveURL(/\/iniciar-plantao/);
    await expect(page.getByTestId("shift-ambiente")).toContainText(/Clínica Médica/i);
  });

  test("avisa 'Em breve' antes do toque e a tela de construção oferece saída", async ({ page }) => {
    await page.goto("/");

    const chip = page.getByTestId("hub-sub-uti-neonatal");
    await expect(chip).toContainText(/Em breve/i);

    await chip.click();
    await expect(page).toHaveURL(/\/ambiente\/uti\/uti-neonatal/);
    await expect(page.getByTestId("em-construcao")).toBeVisible();

    // Nunca um beco sem saída: daqui dá para chegar ao que já funciona.
    await page.getByRole("link", { name: /Passagem de plantão/i }).click();
    await expect(page).toHaveURL(/\/passagem-plantao/);
  });

  test("a passagem de plantão é alcançável a partir da Enfermaria", async ({ page }) => {
    await page.goto("/ambiente/enfermaria");

    await expect(page.getByRole("heading", { name: /Enfermaria de Internamento/i })).toBeVisible();
    await page.getByTestId("ambiente-atalho-passagem-plantao").click();
    await expect(page).toHaveURL(/\/passagem-plantao/);
  });

  test("as ações rápidas funcionam sem plantão aberto", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("hub-resumo-exames").click();
    await expect(page).toHaveURL(/\/resumo-exames/);
  });

  test("o tema alterna, persiste e não pisca branco ao recarregar", async ({ page }) => {
    await page.goto("/");

    const html = page.locator("html");
    const toggle = page.getByTestId("theme-toggle");
    const escuro = () => html.evaluate((el) => el.classList.contains("dark"));

    // O ciclo é automático → claro → escuro → automático. O navegador de teste
    // reporta preferência clara, então o primeiro toque fixa "claro".
    await expect.poll(escuro).toBe(false);
    await toggle.click();
    await expect.poll(escuro).toBe(false);
    await toggle.click();
    await expect.poll(escuro).toBe(true);

    // O script inline do index.html reaplica a classe antes do React montar —
    // é isso que evita o flash branco ao recarregar no escuro.
    await page.reload();
    await expect(html).toHaveClass(/\bdark\b/);
    expect(await page.evaluate(() => localStorage.getItem("da_tema"))).toBe("dark");

    await toggle.click();
    await expect.poll(escuro).toBe(false);
    expect(await page.evaluate(() => localStorage.getItem("da_tema"))).toBe("system");
  });
});
