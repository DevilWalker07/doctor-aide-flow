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

    // 6. Passagem de plantão — o fluxo completo está em passagem.spec.ts.
    await page.goto("/passagem-plantao");
    await page.getByTestId("handoff-files").setInputFiles([fixture("test.docx")]);
    await page.getByTestId("handoff-generate").click();
    const download = page.waitForEvent("download", { timeout: 60_000 });
    await page.getByTestId("handoff-download").click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.docx$/);
  });

  test("sem trava de login, o dashboard abre direto — sem redirecionar", async ({ page }) => {
    // O teste antigo afirmava o contrário: que /dashboard mandava para /login.
    // Isso deixou de valer quando a trava saiu, e teste que afirma o que não é
    // mais verdade só serve para dar falsa segurança.
    await page.goto("/dashboard");
    await expect(page).not.toHaveURL(/\/login/);
  });
});
