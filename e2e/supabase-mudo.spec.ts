import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { seedDoctor } from "./helpers/auth";
import { gerarDocxFicticio } from "../tests/fixtures/passagem/docxFicticio";

/**
 * O plantão com o Supabase pendurado — o estado da produção em 10/2026.
 *
 * O projeto estava no ar e o endereço certo, mas nenhuma chamada da função
 * voltava. Como o navegador guardava sessão, toda chamada de IA mandava token,
 * o servidor ia conferir no Supabase e pendurava 60 s: passagem, evolução,
 * copiloto, envio de documento. Este spec roda o plantão inteiro nessas
 * condições. Só roda com `E2E_SUPABASE_MUDO=1` (ver playwright.config.ts).
 */
test.skip(process.env.E2E_SUPABASE_MUDO !== "1", "só com E2E_SUPABASE_MUDO=1");

const fixture = (name: string) =>
  fileURLToPath(new URL(`../tests/fixtures/${name}`, import.meta.url));

test.beforeEach(async ({ page }) => {
  await seedDoctor(page);
  // Sessão salva, como no navegador de quem já fez login: é ela que faz o
  // apiFetch mandar token em toda chamada.
  await page.addInitScript(() => {
    const agora = Math.floor(Date.now() / 1000);
    localStorage.setItem(
      "sb-127-auth-token",
      JSON.stringify({
        access_token: "token-de-teste",
        token_type: "bearer",
        expires_in: 86_400,
        expires_at: agora + 86_400,
        refresh_token: "refresh-de-teste",
        user: { id: "00000000-0000-4000-8000-000000000001", email: "medico@teste.local" },
      }),
    );
  });
});

test("plantão inteiro com o Supabase mudo", async ({ page }) => {
  test.setTimeout(240_000);
  const naHora = { timeout: 20_000 };

  await page.goto("/iniciar-plantao");
  await page.locator("#hospital-name").fill("HOSPITAL E2E");
  await page.getByTestId("shift-submit").click();
  await expect(page).toHaveURL(/\/tipo/, naHora);
  await page.getByTestId("tipo-enfermaria_clinica").click();
  await expect(page).toHaveURL(/\/dashboard/, naHora);

  // Envio de documento → revisar → salvar.
  await page.getByTestId("dashboard-add-patient").click();
  await page.getByTestId("patient-situacao-admissao").click();
  await page.getByTestId("patient-card-arquivo").click();
  await page.getByTestId("upload-input").setInputFiles(fixture("evolucao.txt"));
  await page.getByTestId("upload-submit").click();
  await expect(page).toHaveURL(/\/revisar-extracao/, naHora);
  await expect(page.getByRole("textbox").first()).toHaveValue(/PACIENTE TESTE E2E/i);
  await page.getByTestId("extraction-save").click();
  await expect(page).toHaveURL(/\/paciente\//, naHora);
  const pacienteUrl = page.url();

  // Evolução com IA.
  await page.goto(pacienteUrl.replace("/paciente/", "/evolucao/"));
  await page.getByTestId("evolution-generate").click();
  await expect(page.getByTestId("evolution-text")).toHaveValue(/EVOLUÇÃO MÉDICA/i, naHora);
  await page.getByTestId("evolution-save").click();
  await expect(page).toHaveURL(/\/paciente\//, naHora);

  // Passagem de plantão.
  await page.goto("/passagem-plantao");
  await page.getByTestId("handoff-files").setInputFiles([
    {
      name: "L03-JOAQUIM.docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: await gerarDocxFicticio(),
    },
  ]);
  await page.getByTestId("handoff-generate").click();
  await expect(page.getByTestId("handoff-download")).toBeVisible(naHora);

  // Copiloto.
  await page.goto("/copiloto");
  await page.getByRole("button", { name: /Dr\. Victor/ }).click();
  await page.getByTestId("copiloto-input").fill("Dose de vancomicina com ClCr 25?");
  await page.getByTestId("copiloto-send").click();
  await expect(page.getByTestId("copiloto-msg-assistant").last()).toContainText(/MOCK/, naHora);
});
