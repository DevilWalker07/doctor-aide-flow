import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { ensureSession, seedDoctor, withSupabase } from "./helpers/auth";

const fixture = (name: string) =>
  fileURLToPath(new URL(`../tests/fixtures/${name}`, import.meta.url));

test.describe("fluxo principal: plantão → paciente → upload IA → evolução → passagem", () => {
  test("percorre o fluxo com backend em AI_MOCK", async ({ page }) => {
    await seedDoctor(page);
    await ensureSession(page);

    // 1. Iniciar plantão
    await page.goto("/iniciar-plantao");
    await page.locator("#hospital-name").fill("HOSPITAL E2E");
    await page.getByTestId("shift-submit").click();
    await expect(page).toHaveURL(/\/tipo/);
    await page.getByTestId("tipo-enfermaria_clinica").click();
    await expect(page).toHaveURL(/\/dashboard/);

    // 2. Novo paciente → upload IA (uma tela, não três)
    await page.getByTestId("dashboard-add-patient").click();
    await expect(page).toHaveURL(/\/novo-paciente/);
    await page.getByTestId("patient-situacao-admissao").click();
    await page.getByTestId("patient-card-arquivo").click();
    await expect(page).toHaveURL(/\/upload-ia/);

    // 3. Upload → processando → revisar
    await page.getByTestId("upload-input").setInputFiles(fixture("evolucao.txt"));
    await page.getByTestId("upload-submit").click();
    // /processando/:jobId faz o polling e, com AI_MOCK, chega em segundos à revisão
    await expect(page).toHaveURL(/\/revisar-extracao/, { timeout: 60_000 });
    await expect(page.getByRole("textbox").first()).toHaveValue(/PACIENTE TESTE E2E/i);

    // 4. Salvar paciente → ficha
    await page.getByTestId("extraction-save").click();
    await expect(page).toHaveURL(/\/paciente\//, { timeout: 30_000 });
    const pacienteUrl = page.url();

    // 5. Evolução com IA
    await page.goto(pacienteUrl.replace("/paciente/", "/evolucao/"));
    await page.getByTestId("evolution-generate").click();
    await expect(page.getByTestId("evolution-text")).toHaveValue(/EVOLUÇÃO MÉDICA/i, {
      timeout: 30_000,
    });
    await page.getByTestId("evolution-save").click();
    await expect(page).toHaveURL(/\/paciente\//);

    // 6. Passagem de plantão IA (DOCX)
    await page.goto("/passagem-plantao");
    await page
      .getByTestId("handoff-files")
      .setInputFiles([fixture("evolucao.txt"), fixture("test.docx")]);
    await page.getByTestId("handoff-generate").click();
    const download = page.waitForEvent("download", { timeout: 60_000 });
    await page.getByTestId("handoff-download").click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.docx$/);
    const stream = await file.createReadStream();
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(Buffer.from(c));
    expect(Buffer.concat(chunks).subarray(0, 2).toString("latin1")).toBe("PK");
  });

  /**
   * Este teste existe por causa de um erro real em produção.
   *
   * A tela mostrava só "Não foi possível preparar o envio." e descartava o
   * corpo da resposta — onde estava a causa. Eu fiquei sem diagnóstico e o
   * médico, sem saber o que fazer. A regra vale aqui como no resto do app:
   * quando algo falha, dizer O QUÊ falhou.
   */
  test("quando o envio falha, a tela mostra o motivo do servidor, não um resumo", async ({
    page,
  }) => {
    await page.route("**/api/extract/preparar-upload", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "storage_indisponivel",
          message: "Armazenamento de arquivos não configurado nesta implantação.",
        }),
      }),
    );

    await page.goto("/passagem-plantao");
    await page.getByTestId("handoff-files").setInputFiles([fixture("evolucao.txt")]);
    await page.getByTestId("handoff-generate").click();

    // O motivo do servidor e o código, para dar para agir sem abrir o inspetor.
    await expect(page.getByText(/Armazenamento de arquivos não configurado/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/503/)).toBeVisible();
  });

  test("sem trava de login, o dashboard abre direto — sem redirecionar", async ({ page }) => {
    // O teste antigo afirmava o contrário: que /dashboard mandava para /login.
    // Isso deixou de valer quando a trava saiu, e teste que afirma o que não é
    // mais verdade só serve para dar falsa segurança.
    await page.goto("/dashboard");
    await expect(page).not.toHaveURL(/\/login/);
  });
});
