import { expect, test } from "@playwright/test";
import { ensureSession, seedDoctor } from "./helpers/auth";

test.describe("hub de ambientes", () => {
  test.beforeEach(async ({ page }) => {
    await seedDoctor(page);
    await ensureSession(page);
  });

  test("leva de um local pronto ao início de plantão, com o local já escolhido", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByTestId("hub-local-enfermaria-clinica")).toBeVisible();
    await page.getByTestId("hub-local-enfermaria-clinica").click();

    // Um toque vai direto ao destino: /local/:id redireciona para o início de
    // plantão em vez de parar numa tela intermediária.
    await expect(page).toHaveURL(/\/iniciar-plantao/);
    await expect(page.getByTestId("shift-ambiente")).toContainText(/Enfermaria Clínica/i);
  });

  test("mostra as quatro ações rápidas", async ({ page }) => {
    await page.goto("/");
    for (const id of ["hub-documentos", "hub-copiloto", "hub-resumo-exames", "hub-plantao-acao"]) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
  });

  test("avisa 'Em breve' antes do toque e a tela de construção oferece saída", async ({ page }) => {
    await page.goto("/");

    const item = page.getByTestId("hub-local-uti-neonatal");
    await expect(item).toContainText(/Em breve/i);

    await item.click();
    await expect(page).toHaveURL(/\/local\/uti-neonatal/);
    await expect(page.getByTestId("em-construcao")).toBeVisible();

    // Nunca um beco sem saída: daqui dá para chegar ao que já funciona.
    await page.getByRole("link", { name: /Passagem de plantão/i }).click();
    await expect(page).toHaveURL(/\/passagem-plantao/);
  });

  test("os documentos abrem pela ação rápida, sem plantão", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("hub-documentos").click();
    await expect(page).toHaveURL(/\/documentos/);

    await expect(page.getByTestId("doc-atestado")).toBeVisible();
    // Os tipos ainda não construídos avisam antes do toque.
    await expect(page.getByTestId("doc-apac")).toContainText(/Em breve/i);

    await page.getByTestId("doc-atestado").click();
    await expect(page).toHaveURL(/\/atestado/);
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
