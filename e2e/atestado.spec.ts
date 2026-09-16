import { expect, test } from "@playwright/test";
import { ensureSession, seedDoctor } from "./helpers/auth";

test.describe("atestado médico", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await seedDoctor(page);
    await ensureSession(page);
    await page.goto("/atestado");
  });

  test("o CID só aparece com autorização do paciente", async ({ page }) => {
    await page.getByTestId("doc-paciente-nome").fill("MARIA DE SOUZA");
    await page.getByTestId("doc-paciente-nome").blur();
    await page.getByTestId("atestado-dias").fill("3");
    await page.getByTestId("atestado-dias").blur();

    const previa = page.getByTestId("doc-preview-atestado");
    await expect(previa).toContainText(/por 3 dias/i);

    // Sem a autorização marcada não existe nem campo de CID para preencher.
    await expect(page.getByTestId("atestado-cid")).toHaveCount(0);
    await expect(previa).not.toContainText("J18.9");

    await page.getByTestId("atestado-cid-autorizado").check();
    await page.getByTestId("atestado-cid").fill("J18.9");
    await page.getByTestId("atestado-cid").blur();
    await expect(previa).toContainText("J18.9");
    await expect(previa).toContainText(/autorização do paciente/i);

    // Desmarcar tira o diagnóstico do documento, mesmo com o CID digitado.
    await page.getByTestId("atestado-cid-autorizado").uncheck();
    await expect(previa).not.toContainText("J18.9");
  });

  test("troca de finalidade pede os dados daquela finalidade", async ({ page }) => {
    await page.getByTestId("doc-paciente-nome").fill("JOÃO DA SILVA");
    await page.getByTestId("doc-paciente-nome").blur();

    await page.getByTestId("atestado-finalidade-acompanhante").click();
    // Sem o nome de quem foi acompanhado, o atestado não se forma.
    await expect(page.getByTestId("doc-preview-atestado")).toContainText(/Preencha o nome/i);

    await page.getByTestId("atestado-acompanhado").fill("ANA DA SILVA");
    await page.getByTestId("atestado-acompanhado").blur();
    await expect(page.getByTestId("doc-preview-atestado")).toContainText(
      /como acompanhante de ANA DA SILVA/i,
    );
  });

  test("copia o texto limpo para o WhatsApp", async ({ page }) => {
    await page.getByTestId("doc-paciente-nome").fill("MARIA DE SOUZA");
    await page.getByTestId("doc-paciente-nome").blur();
    await page.getByTestId("doc-copy").click();

    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain("ATESTADO MÉDICO");
    expect(clip).toContain("MARIA DE SOUZA");
  });

  test("é alcançável pelas abas de documento", async ({ page }) => {
    await page.getByTestId("tab-receita").click();
    await expect(page).toHaveURL(/\/prescricao-alta/);
    await page.getByTestId("tab-atestado").click();
    await expect(page).toHaveURL(/\/atestado/);
  });
});
