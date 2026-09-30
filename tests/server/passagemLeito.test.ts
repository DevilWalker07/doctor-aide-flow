import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { makeApp } from "./helpers/app.js";
import { aiMock, resetAiMock } from "./helpers/mocks.js";
import { markdownFicticio } from "../fixtures/passagem/docxFicticio.js";
import { mockPassagemLeito } from "../../server/mocks/passagemMock.js";
import { normalizarLeito } from "../../server/services/passagemLeito.service.js";

const { app } = makeApp();
const auth = { Authorization: "Bearer valid-token" };

function lerLeito(body: Record<string, unknown>) {
  return request(app).post("/api/ai/passagem-leito").set(auth).send(body);
}

/** Resposta da IA com o que o teste quiser sobrescrever. */
function iaDevolve(sobre: Record<string, unknown>) {
  aiMock.json.mockImplementationOnce(async (_s, p, schema) => ({
    ok: true,
    data: schema.parse({ ...mockPassagemLeito(p), ...sobre }),
  }));
}

beforeEach(() => resetAiMock());

describe("POST /api/ai/passagem-leito", () => {
  it("lê o leito pelo cabeçalho mais recente e relata o conflito", async () => {
    const markdown = await markdownFicticio({ leito: "03" });
    const res = await lerLeito({
      markdown,
      arquivo: "L03-_JOAQUIM_FICTICIO_25.09.26.docx",
      dataPlantao: "25/09/2026",
    }).expect(200);

    expect(res.body.linha.leito).toBe("L03");
    expect(res.body.linha.paciente).toContain("JOAQUIM FICTÍCIO DA SILVA");
    expect(res.body.avisos.join(" ")).toMatch(
      /UNIDADE: HOSPITAL FICTÍCIO NAIR .*× UNIDADE DE PRONTO/,
    );
    expect(res.body.linha.alertasPendencias).toContain("! Cabeçalhos divergentes");
    // A IA viu o documento inteiro, com os dois cabeçalhos rotulados.
    const payload = aiMock.json.mock.calls[0][1] as { documento: string };
    expect(payload.documento).toContain("## Cabeçalho — primeira página");
    expect(payload.documento).toContain("## Cabeçalho — demais páginas");
  });

  it("DI é calculado em código a partir da DATA DA ADMISSÃO", async () => {
    const markdown = await markdownFicticio({ admissao: "20/09/2026" });
    const res = await lerLeito({ markdown, arquivo: "L03.docx", dataPlantao: "25/09/2026" }).expect(
      200,
    );
    expect(res.body.linha.dih).toBe("20/09/2026");
    expect(res.body.linha.di).toBe(6);
  });

  it("leito do cabeçalho ≠ leito do arquivo → alerta !!, nada escolhido em silêncio", async () => {
    const markdown = await markdownFicticio({ leito: "05" });
    const res = await lerLeito({
      markdown,
      arquivo: "L04 - JOAQUIM.docx",
      dataPlantao: "25/09/2026",
    }).expect(200);
    expect(res.body.linha.leito).toBe("L05");
    expect(res.body.linha.alertasPendencias).toContain(
      "!! Leito divergente: cabeçalho diz L05, arquivo diz L04 — confira",
    );
  });

  it("sem cabeçalho, leito e nome saem do nome do arquivo, marcados como tal", async () => {
    iaDevolve({ identificacao: { nome: null, leito: null, dih: null, fonte: "", conflitos: [] } });
    const res = await lerLeito({
      markdown: "EVOLUÇÃO MÉDICA\nPACIENTE ESTÁVEL, SEM QUEIXAS NOVAS.",
      arquivo: "ISO 12 - GABRIEL CORDEIRO.pdf",
      dataPlantao: "25/09/2026",
    }).expect(200);
    expect(res.body.linha.leito).toBe("ISO 12");
    expect(res.body.linha.paciente).toBe("GABRIEL CORDEIRO");
    expect(res.body.avisos.join(" ")).toContain("Leito tirado do nome do arquivo");
    expect(res.body.linha.di).toBeNull();
  });

  it("potássio crítico vira !! pelo guardrail, mesmo sem a IA marcar", async () => {
    const markdown = await markdownFicticio({ potassio: "6,8" });
    const res = await lerLeito({ markdown, arquivo: "L03.docx", dataPlantao: "25/09/2026" }).expect(
      200,
    );
    expect(res.body.linha.ultimoLab).toContain("K 6,8");
    expect(res.body.linha.alertasPendencias).toMatch(/^!! LAB CRÍTICO: .*6,8/);
    expect(res.body.alertas[0].prioridade).toBe("!! URGENTE");
  });

  it("marca o leito lido de imagem", async () => {
    const markdown = await markdownFicticio();
    const res = await lerLeito({
      markdown,
      arquivo: "foto.jpg",
      dataPlantao: "25/09/2026",
      lidoDeImagem: true,
    }).expect(200);
    expect(res.body.linha.lidoDeImagem).toBe(true);
  });

  it("recusa documento sem texto, dizendo o motivo", async () => {
    const res = await lerLeito({
      markdown: "   ",
      arquivo: "x.docx",
      dataPlantao: "25/09/2026",
    }).expect(400);
    expect(JSON.stringify(res.body.issues)).toContain("não tem texto legível");
  });

  it("recusa campo desconhecido em vez de descartar calado", async () => {
    const markdown = await markdownFicticio();
    await lerLeito({
      markdown,
      arquivo: "x.docx",
      dataPlantao: "25/09/2026",
      storage_path: "a",
    }).expect(400);
  });

  it("recusa data fora de DD/MM/AAAA", async () => {
    const markdown = await markdownFicticio();
    await lerLeito({ markdown, arquivo: "x.docx", dataPlantao: "2026-09-25" }).expect(400);
  });

  it("IA inválida → a chamada falha, sem linha sintética", async () => {
    aiMock.json.mockResolvedValueOnce({ ok: false, error: "JSON inválido" });
    const markdown = await markdownFicticio();
    const res = await lerLeito({ markdown, arquivo: "x.docx", dataPlantao: "25/09/2026" }).expect(
      502,
    );
    expect(res.body.message).toContain("JSON inválido");
    expect(res.body.linha).toBeUndefined();
  });
});

describe("POST /api/ai/transcrever", () => {
  const imagem = { base64: "A".repeat(200), mime: "image/jpeg" };

  it("devolve Markdown e mantém [ilegível] como veio", async () => {
    const res = await request(app)
      .post("/api/ai/transcrever")
      .set(auth)
      .send({ imagem })
      .expect(200);
    expect(res.body.markdown).toContain("K [ilegível]");
    expect(res.body.trechos_ilegiveis).toHaveLength(1);
    const opts = aiMock.json.mock.calls[0][3];
    expect(opts?.images).toHaveLength(1);
  });

  it("recusa corpo sem imagem", async () => {
    await request(app).post("/api/ai/transcrever").set(auth).send({}).expect(400);
  });

  it("recusa formato que não é imagem", async () => {
    await request(app)
      .post("/api/ai/transcrever")
      .set(auth)
      .send({ imagem: { ...imagem, mime: "application/pdf" } })
      .expect(400);
  });
});

describe("POST /api/ai/passagem-consolidar", () => {
  const linha = (leito: string, alertasPendencias = "") => ({
    leito,
    paciente: `PACIENTE ${leito}`,
    di: 3,
    diagnostico: "PAC",
    quadroAtual: "ESTÁVEL —",
    atb: "SEM ATB",
    ultimoLab: "Sem lab recente",
    condutasHoje: "",
    alertasPendencias,
  });

  it("devolve prioridades e as cinco categorias de pendência", async () => {
    const res = await request(app)
      .post("/api/ai/passagem-consolidar")
      .set(auth)
      .send({
        dataPlantao: "25/09/2026",
        passagemPara: "26/09/2026",
        leitos: [linha("L01"), linha("L02")],
      })
      .expect(200);
    expect(res.body.prioridades.length).toBeGreaterThan(0);
    expect(Object.keys(res.body.pendencias).sort()).toEqual([
      "admissoesPendentes",
      "altasEmProgramacao",
      "avisosCriticos",
      "labsAIncorporar",
      "procedimentosAgendados",
    ]);
  });

  it("descarta prioridade de leito que não foi lido e garante todo alerta !!", async () => {
    aiMock.json.mockImplementationOnce(async (_s, _p, schema) => ({
      ok: true,
      data: schema.parse({
        prioridades: [
          { prioridade: "! HOJE", leito: "L01", paciente: "A", texto: "REVISAR" },
          { prioridade: "!! URGENTE", leito: "L09", paciente: "INVENTADO", texto: "NÃO EXISTE" },
        ],
        pendencias: {},
      }),
    }));
    const res = await request(app)
      .post("/api/ai/passagem-consolidar")
      .set(auth)
      .send({
        dataPlantao: "25/09/2026",
        leitos: [
          linha("L01"),
          linha("L02", "!! LAB CRÍTICO: K 6,8 — REAVALIAR\n— PENDÊNCIAS —\n- x"),
        ],
      })
      .expect(200);
    const leitos = res.body.prioridades.map((p: { leito: string }) => p.leito);
    expect(leitos).not.toContain("L09");
    // Urgente primeiro.
    expect(res.body.prioridades[0]).toMatchObject({ prioridade: "!! URGENTE", leito: "L02" });
    expect(res.body.prioridades[0].texto).toContain("K 6,8");
  });

  it("recusa lista vazia de leitos", async () => {
    await request(app)
      .post("/api/ai/passagem-consolidar")
      .set(auth)
      .send({ dataPlantao: "25/09/2026", leitos: [] })
      .expect(400);
  });
});

describe("normalizarLeito", () => {
  it.each([
    ["01", "L01"],
    ["LEITO 5", "L05"],
    ["l 07", "L07"],
    ["ISOLAMENTO 12", "ISO 12"],
    ["iso-13", "ISO 13"],
    ["MACA CORREDOR", "MACA CORREDOR"],
  ])("%s → %s", (entrada, saida) => {
    expect(normalizarLeito(entrada)).toBe(saida);
  });
});
