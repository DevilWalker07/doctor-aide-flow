import { expect, test } from "@playwright/test";
import { ensureSession, seedDoctor } from "./helpers/auth";

const PACIENTE = {
  id: "temp_voz",
  nome: "JOÃO E2E",
  idade: 64,
  sexo: "M",
  leito: "L12",
  lista_de_problemas: ["PAC"],
  medicacoes: [],
  antibioticos: [],
};

test.describe("ditado por voz na evolução", () => {
  test.beforeEach(async ({ page }) => {
    await seedDoctor(page);
    await page.addInitScript((p) => {
      localStorage.setItem("da_pacientes", JSON.stringify([p]));
    }, PACIENTE);
    await ensureSession(page);
  });

  test("o bloco de ditado abre recolhido e as anotações vão para a geração", async ({ page }) => {
    await page.goto("/evolucao/temp_voz");

    // Recolhido por padrão: quem prefere digitar não perde espaço de tela.
    await expect(page.getByTestId("voice-notes")).toBeHidden();

    await page.getByTestId("voice-disclosure").click();
    await expect(page.getByTestId("voice-disclosure")).toHaveAttribute("aria-expanded", "true");

    const notas = page.getByTestId("voice-notes");
    await notas.fill("PACIENTE REFERE MELHORA DA DISPNEIA E ACEITA DIETA.");

    // O backend precisa aceitar raw_notes, senão o Zod descarta em silêncio.
    const chamada = page.waitForRequest(
      (req) => req.url().includes("/api/ai/gerar-evolucao") && req.method() === "POST",
    );
    await page.getByTestId("evolution-generate").click();
    const req = await chamada;
    expect(req.postDataJSON().raw_notes).toContain("MELHORA DA DISPNEIA");

    await expect(page.getByTestId("evolution-text")).toHaveValue(/EVOLUÇÃO MÉDICA/i);
  });

  test("sem Web Speech API, explica o que fazer em vez de mostrar botão morto", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      // Chromium headless pode expor o construtor sem serviço de transcrição.
      Reflect.deleteProperty(window, "SpeechRecognition");
      Reflect.deleteProperty(window, "webkitSpeechRecognition");
    });
    await page.goto("/evolucao/temp_voz");
    await page.getByTestId("voice-disclosure").click();

    await expect(page.getByTestId("voice-unsupported")).toContainText(/Chrome ou o Edge/i);
    await expect(page.getByTestId("voice-toggle")).toHaveCount(0);
    // Mesmo sem microfone, dá para digitar as anotações.
    await expect(page.getByTestId("voice-notes")).toBeVisible();
  });

  test("oferece restaurar o rascunho de quem foi interrompido", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "da_voz_rascunho_temp_voz",
        JSON.stringify({ text: "ABDOME FLÁCIDO, INDOLOR.", savedAt: new Date().toISOString() }),
      );
    });
    await page.goto("/evolucao/temp_voz");
    await page.getByTestId("voice-disclosure").click();

    await page.getByTestId("voice-restore").click();
    await expect(page.getByTestId("voice-notes")).toHaveValue(/ABDOME FLÁCIDO/);
    await expect(page.getByTestId("voice-restore")).toHaveCount(0);
  });
});
