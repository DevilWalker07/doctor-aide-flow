import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { makeApp } from "./helpers/app.js";
import { aiMock, resetAiMock } from "./helpers/mocks.js";

const { app } = makeApp();

beforeEach(() => resetAiMock());

describe("POST /api/ai/extrair-documento", () => {
  it("devolve os dados na mesma resposta, sem job nem Storage", async () => {
    const res = await request(app)
      .post("/api/ai/extrair-documento")
      .send({
        markdown: "EVOLUÇÃO MÉDICA\nPACIENTE COM PNEUMONIA, EM USO DE CEFTRIAXONA.",
        arquivo: "l01.docx",
      })
      .expect(200);
    expect(res.body.nome).toBe("PACIENTE TESTE E2E");
    expect(res.body.suggested_patient.name).toBe("PACIENTE TESTE E2E");
    expect(res.body.fileName).toBe("l01.docx");
  });

  it("documento lido de imagem ganha o alerta de conferência", async () => {
    const res = await request(app)
      .post("/api/ai/extrair-documento")
      .send({
        markdown: "EVOLUÇÃO MÉDICA\nK [ilegível] NO LABORATÓRIO DE HOJE.",
        arquivo: "foto.jpg",
        lidoDeImagem: true,
      })
      .expect(200);
    expect(res.body.alertas.join(" ")).toContain("LIDO DE IMAGEM");
  });

  it("recusa documento sem texto", async () => {
    await request(app)
      .post("/api/ai/extrair-documento")
      .send({ markdown: " ", arquivo: "x" })
      .expect(400);
  });

  it("IA falhou → a chamada falha, sem dado sintético", async () => {
    aiMock.json.mockResolvedValueOnce({ ok: false, error: "JSON inválido" });
    const res = await request(app)
      .post("/api/ai/extrair-documento")
      .send({ markdown: "EVOLUÇÃO MÉDICA\nPACIENTE ESTÁVEL, SEM QUEIXAS.", arquivo: "x.docx" });
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.body.nome).toBeUndefined();
  });
});
