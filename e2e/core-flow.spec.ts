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
    await page
      .getByRole("button", { name: /Enfermaria Clínica Médica/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/dashboard/);

    // 2. Novo paciente → admissão nova → upload IA
    await page.getByTestId("dashboard-add-patient").click();
    await expect(page).toHaveURL(/\/novo-paciente/);
    await page.getByTestId("patient-card-admissao").click();
    await expect(page).toHaveURL(/\/admissao-nova/);
    await page.getByTestId("admissao-upload").click();
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

  test("sem sessão, rotas protegidas redirecionam para /login", async ({ page }) => {
    test.skip(!withSupabase, "exige Supabase local (E2E_SUPABASE_*)");
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?redirect=/);
  });
});
