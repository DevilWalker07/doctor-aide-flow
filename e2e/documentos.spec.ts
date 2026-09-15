import { expect, test } from "@playwright/test";
import { ensureSession, seedDoctor } from "./helpers/auth";

test.describe("documentos ambulatoriais", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await seedDoctor(page);
    await page.addInitScript(() => {
      localStorage.setItem(
        "da_pacientes",
        JSON.stringify([{ id: "temp_e2e", nome: "MARIA E2E", idade: 70, sexo: "F", leito: "L07", lista_de_problemas: ["HAS", "DM2"], medicacoes: ["LOSARTANA 50MG"], antibioticos: [] }]),
      );
    });
    await ensureSession(page);
  });

  test("receita avulsa: catálogo, grade de horários, Farmácia Popular, cópia e salvamento", async ({ page }) => {
    await page.goto("/prescricao-alta");
    await expect(page.getByTestId("doc-modo")).toContainText("MODO AVULSO");
    await page.getByTestId("doc-paciente-nome").fill("JOSE AVULSO");
    await page.getByTestId("doc-paciente-nome").blur();
    await page.getByTestId("doc-med-search").fill("espiro");
    await page.getByTestId("doc-add-med-espironolactona-25").click();

    const preview = page.getByTestId("doc-preview-receita");
    await expect(preview).toContainText(/espironolactona/i);
    await expect(preview).toContainText("Tomar 1 comprimido pela manhã");
    await expect(preview).toContainText("Farmácia Popular");
    await expect(page.getByTestId("doc-item-0-manha")).toHaveText("1");

    await page.getByTestId("doc-copy").click();
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: /copiado/i }).first()).toBeVisible();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain("🌅");
    expect(clip).toContain("Espironolactona 25 mg");

    await page.getByTestId("doc-save").click();
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: /salvo/i }).first()).toBeVisible();
  });

  test("receita vinculada pré-preenche paciente e aceita sugestão da IA", async ({ page }) => {
    await page.goto("/prescricao-alta?paciente=temp_e2e");
    await expect(page.getByTestId("doc-modo")).toContainText("VINCULADO A: MARIA E2E");
    await expect(page.getByTestId("doc-paciente-nome")).toHaveValue("MARIA E2E");
    await expect(page.getByTestId("doc-paciente-idade")).toHaveValue("70");
    await page.getByTestId("doc-ai-suggest").click();
    await expect(page.getByTestId("doc-preview-item-0")).toContainText(/losartana/i, { timeout: 30_000 });
  });

  test("encaminhamento e orientações geram preview e texto limpo", async ({ page }) => {
    await page.goto("/encaminhamento?paciente=temp_e2e");
    await expect(page.getByTestId("doc-modo")).toContainText("VINCULADO");
    await page.getByTestId("doc-destino-nefrologia").click();
    await page.getByTestId("doc-justificativa").fill("Piora de função renal.");
    await page.getByTestId("doc-justificativa").blur();
    await expect(page.getByTestId("doc-preview-encaminhamento")).toContainText("Nefrologia");
    await expect(page.getByTestId("doc-preview-encaminhamento")).toContainText("HAS");

    await page.getByTestId("tab-orientacoes").click();
    await expect(page).toHaveURL(/\/orientacoes-paciente\?paciente=temp_e2e/);
    await page.getByTestId("doc-orientacao-diabetes").click();
    await page.getByTestId("doc-orientacao-sinais-alerta-gerais").click();
    await expect(page.getByTestId("doc-preview-orientacoes")).toContainText("Cuidados com o diabetes");
    await page.getByTestId("doc-copy").click();
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: /copiado/i }).first()).toBeVisible();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain("✅");
    expect(clip).toContain("🚨");
  });

  test("ficha do paciente leva à receita de alta vinculada", async ({ page }) => {
    await page.goto("/paciente/temp_e2e");
    await page.getByTestId("paciente-receita-alta").click();
    await expect(page).toHaveURL(/\/prescricao-alta\?paciente=temp_e2e/);
  });
});
