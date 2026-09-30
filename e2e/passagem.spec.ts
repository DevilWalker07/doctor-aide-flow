import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Download, type Page } from "@playwright/test";
import mammoth from "mammoth";
import { gerarDocxFicticio } from "../tests/fixtures/passagem/docxFicticio";

/**
 * A passagem de plantão pelo mesmo caminho da produção.
 *
 * Antes o e2e rodava por um caminho (multipart no contêiner) e a produção por
 * outro (Storage e job na função) — e os testes ficaram verdes com a produção
 * quebrada. Agora só existe um caminho: o navegador lê o arquivo, chama a IA
 * (aqui em AI_MOCK) leito por leito e monta o DOCX. É isso que roda abaixo.
 *
 * Todos os documentos são fictícios, gerados aqui.
 */

const fixture = (name: string) =>
  fileURLToPath(new URL(`../tests/fixtures/${name}`, import.meta.url));

async function docx(nome: string, opcoes: Parameters<typeof gerarDocxFicticio>[0] = {}) {
  return {
    name: nome,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: await gerarDocxFicticio(opcoes),
  };
}

/** Uma foto: PNG de 1×1. O conteúdo não importa — o transcritor está em mock. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  "base64",
);

/** PDF escaneado: uma página com desenho e nenhum texto. */
function pdfSemTexto(): Buffer {
  const conteudo = "0.2 0.2 0.2 rg 72 600 300 120 re f";
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << >> >>",
    `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objetos.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) pdf += `${String(o).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

async function textoDoDownload(download: Download): Promise<string> {
  const caminho = await download.path();
  const buffer = fs.readFileSync(caminho!);
  expect(buffer.subarray(0, 2).toString("latin1")).toBe("PK");
  return (await mammoth.extractRawText({ buffer })).value;
}

async function gerarEBaixar(page: Page): Promise<string> {
  await page.getByTestId("handoff-generate").click();
  const link = page.getByTestId("handoff-download");
  await expect(link).toBeVisible({ timeout: 60_000 });
  const download = page.waitForEvent("download");
  await link.click();
  const arquivo = await download;
  expect(arquivo.suggestedFilename()).toMatch(/^MAPA_PASSAGEM_.*\.docx$/);
  return textoDoDownload(arquivo);
}

const itens = (page: Page) => page.getByTestId("handoff-item");

test.describe("passagem de plantão", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/passagem-plantao");
    await page.getByTestId("handoff-data").fill("2026-09-25");
  });

  test("Word e PDF viram leitos e o DOCX sai no formato do hospital", async ({ page }) => {
    await page.getByTestId("handoff-files").setInputFiles([
      await docx("L03-_JOAQUIM_FICTICIO_25.09.26.docx", { leito: "03" }),
      await docx("L05_-_ROBERTO_FICTICIO_25.09.2026.docx", {
        leito: "05",
        nome: "ROBERTO FICTÍCIO NUNES",
        admissao: "25/09/2026",
      }),
      {
        name: "L07 - CARLOS PDF.pdf",
        mimeType: "application/pdf",
        buffer: fs.readFileSync(fixture("test.pdf")),
      },
    ]);

    const t = await gerarEBaixar(page);
    await expect(itens(page)).toHaveCount(3);
    for (const item of await itens(page).all()) {
      await expect(item).toHaveAttribute("data-estado", "pronto");
    }

    // As sete colunas, os três leitos e as seções do modelo.
    for (const coluna of [
      "LEITO",
      "PACIENTE / INFO",
      "DIAGNÓSTICOS",
      "ATB (D-ATUAL/D-TOTAL)",
      "ÚLTIMOS LABS",
      "CONDUTAS DE 25/09/2026",
      "ALERTAS / PENDÊNCIAS DO LEITO",
    ]) {
      expect(t, coluna).toContain(coluna);
    }
    expect(t).toContain("PLANTÃO DE 25/09/2026 (DIURNO) → PASSAGEM PARA 26/09/2026");
    expect(t).toContain("JOAQUIM FICTÍCIO DA SILVA");
    expect(t).toContain("ROBERTO FICTÍCIO NUNES");
    expect(t).toContain("CARLOS PDF");
    expect(t).toContain("ENFERMARIA 1: L03, L05 NOVO • ENFERMARIA 2: L07");
    expect(t).toContain("PRIORIDADES PARA O PLANTÃO 26/09/2026");
    expect(t).toContain("PENDÊNCIAS GERAIS – PLANTÃO 26/09/2026");
    expect(t).toContain("FOLHA DE SUGESTÕES CLÍNICAS – ANÁLISE POR LEITO");
    // DI calculado em código: admissão 20/09, plantão 25/09.
    expect(t).toContain("DIH: 20/09/2026 | DI 6d");
  });

  test("cabeçalhos divergentes: vale o mais recente, e o conflito aparece", async ({ page }) => {
    await page.getByTestId("handoff-files").setInputFiles([await docx("L03-JOAQUIM.docx")]);
    const t = await gerarEBaixar(page);
    await expect(itens(page).first()).toContainText("Cabeçalhos divergentes");
    expect(t).toContain("Cabeçalhos divergentes: UNIDADE: HOSPITAL FICTÍCIO NAIR");
  });

  test("leito que falha não derruba os outros e pode ser tentado sozinho", async ({ page }) => {
    let falhar = true;
    await page.route("**/api/ai/passagem-leito", async (route) => {
      const corpo = route.request().postDataJSON() as { arquivo: string };
      if (falhar && corpo.arquivo.startsWith("L05")) {
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: "limite_openai",
            message: "Muitas chamadas à OpenAI agora.",
          }),
        });
      }
      return route.continue();
    });

    await page
      .getByTestId("handoff-files")
      .setInputFiles([
        await docx("L03-JOAQUIM.docx", { leito: "03" }),
        await docx("L05-ROBERTO.docx", { leito: "05" }),
      ]);

    const t = await gerarEBaixar(page);
    const falhou = itens(page).filter({ hasText: "L05-ROBERTO.docx" });
    await expect(falhou).toHaveAttribute("data-estado", "falhou");
    await expect(falhou).toContainText("Muitas chamadas à OpenAI agora. [503]");
    await expect(page.getByTestId("handoff-retry")).toHaveCount(1);
    expect(t).toContain("L05-ROBERTO.docx não foi lido: Muitas chamadas à OpenAI agora.");
    expect(t).toContain("*NÃO LIDOS: L05");
    expect(t).toContain("JOAQUIM FICTÍCIO DA SILVA");

    falhar = false;
    await page.getByTestId("handoff-retry").click();
    await expect(itens(page).filter({ hasText: "L05" }).first()).toHaveAttribute(
      "data-estado",
      "pronto",
    );
    const t2 = await gerarEBaixar(page);
    expect(t2).not.toContain("não foi lido");
  });

  test("foto passa pelo transcritor e sai marcada para conferência", async ({ page }) => {
    const transcricoes: unknown[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/ai/transcrever")) transcricoes.push(r.postDataJSON());
    });
    await page
      .getByTestId("handoff-files")
      .setInputFiles([{ name: "foto_leito.png", mimeType: "image/png", buffer: PNG }]);
    const t = await gerarEBaixar(page);
    expect(transcricoes).toHaveLength(1);
    expect((transcricoes[0] as { imagem: { mime: string } }).imagem.mime).toBe("image/jpeg");
    await expect(itens(page).first()).toContainText("lido de imagem — confira valores");
    expect(t).toContain("PACIENTE FOTO FICTÍCIO");
    expect(t).toContain("LIDO DE IMAGEM — CONFIRA VALORES");
    expect(t).toContain("*LIDOS DE IMAGEM: L08");
  });

  test("PDF escaneado: páginas renderizadas e transcritas", async ({ page }) => {
    const transcricoes: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/ai/transcrever")) transcricoes.push(r.url());
    });
    await page
      .getByTestId("handoff-files")
      .setInputFiles([
        { name: "escaneado.pdf", mimeType: "application/pdf", buffer: pdfSemTexto() },
      ]);
    const t = await gerarEBaixar(page);
    expect(transcricoes).toHaveLength(1);
    expect(t).toContain("PACIENTE FOTO FICTÍCIO");
    expect(t).toContain("LIDO DE IMAGEM — CONFIRA VALORES");
  });

  test("Word antigo (.doc) diz o que fazer, sem chamar a IA", async ({ page }) => {
    let chamadas = 0;
    page.on("request", (r) => {
      if (r.url().includes("/api/ai/")) chamadas++;
    });
    const ole = Buffer.from([
      0xd0,
      0xcf,
      0x11,
      0xe0,
      0xa1,
      0xb1,
      0x1a,
      0xe1,
      ...new Array(64).fill(0),
    ]);
    await page
      .getByTestId("handoff-files")
      .setInputFiles([{ name: "L02.doc", mimeType: "application/msword", buffer: ole }]);
    await page.getByTestId("handoff-generate").click();
    await expect(itens(page).first()).toContainText("salve como .docx");
    await expect(page.getByText("Nenhum leito foi lido")).toBeVisible();
    expect(chamadas).toBe(0);
  });
});
