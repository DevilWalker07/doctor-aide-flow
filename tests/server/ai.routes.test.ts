import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { EvolucaoBody } from "../../server/schemas/ai.schemas.js";
import { AIUnavailableError } from "../../server/lib/errors.js";
import { makeApp } from "./helpers/app.js";
import { aiMock, resetAiMock } from "./helpers/mocks.js";

const { app } = makeApp();
const auth = { Authorization: "Bearer valid-token" };

const JSON_ENDPOINTS: Array<{
  path: string;
  body: Record<string, unknown>;
  check: (b: Record<string, unknown>) => void;
}> = [
  {
    path: "/api/ai/orquestrador",
    body: { rawText: "L01 paciente" },
    check: (b) => expect(b.agent).toBe("clinica-medica"),
  },
  {
    path: "/api/ai/extrair-clinica-medica",
    body: { inputText: "L01 paciente" },
    check: (b) => expect(Array.isArray(b.patients)).toBe(true),
  },
  {
    path: "/api/ai/extrair-pediatria",
    body: { text: "L01 crianca" },
    check: (b) => expect(Array.isArray(b.patients)).toBe(true),
  },
  {
    path: "/api/ai/extrair-uti",
    body: { rawText: "UTI 01" },
    check: (b) => expect(Array.isArray(b.patients)).toBe(true),
  },
  {
    path: "/api/ai/importar-evolucoes-ontem",
    body: { rawText: "ontem" },
    check: (b) => expect(Array.isArray(b.patients)).toBe(true),
  },
  {
    path: "/api/ai/revisar-evolucao",
    body: { evolutionText: "EVOLUCAO MEDICA PACIENTE ESTAVEL SEM QUEIXAS" },
    check: (b) => expect(Array.isArray(b.alertas)).toBe(true),
  },
  {
    path: "/api/ai/sugerir-receita",
    body: { patient: { name: "X" } },
    check: (b) => expect(Array.isArray(b.itens)).toBe(true),
  },
  {
    path: "/api/ai/lab-extractor",
    body: { inputText: "HB 9" },
    check: (b) => expect(b.tipo_exame).toBe("LABORATÓRIO"),
  },
];

const TEXT_ENDPOINTS: Array<{ path: string; body: Record<string, unknown>; field: string }> = [
  { path: "/api/ai/gerar-evolucao", body: { patient: { name: "X" } }, field: "text" },
  { path: "/api/ai/gerar-mapa-plantao", body: { patients: [], sector: "CMF" }, field: "text" },
  { path: "/api/ai/gerar-briefing", body: { patients: [] }, field: "text" },
  {
    path: "/api/ai/gerar-encaminhamento",
    body: { patient: { name: "X" }, reason: "avaliacao" },
    field: "referral_text",
  },
];

describe("/api/ai/*", () => {
  beforeEach(resetAiMock);

  it.each(JSON_ENDPOINTS)(
    "$path responde 200 com fixture validada",
    async ({ path, body, check }) => {
      const res = await request(app).post(path).set(auth).send(body);
      expect(res.status).toBe(200);
      check(res.body);
    },
  );

  it.each(TEXT_ENDPOINTS)("$path responde 200 com texto", async ({ path, body, field }) => {
    const res = await request(app).post(path).set(auth).send(body);
    expect(res.status).toBe(200);
    expect(typeof res.body[field]).toBe("string");
    expect(res.body[field].length).toBeGreaterThan(5);
  });

  it("aceita chamada sem token quando AUTH_OPTIONAL (userId null)", async () => {
    const res = await request(app).post("/api/ai/gerar-briefing").send({ patients: [] });
    expect(res.status).toBe(200);
  });

  it("rejeita token inválido com 401", async () => {
    const res = await request(app)
      .post("/api/ai/gerar-briefing")
      .set("Authorization", "Bearer nope")
      .send({ patients: [] });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("unauthorized");
  });

  it("400 em body inválido com issues", async () => {
    const res = await request(app).post("/api/ai/extrair-clinica-medica").set(auth).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("validation");
    expect(res.body.issues[0].message).toMatch(/inputText/);
  });

  it("400 em evolutionText curto", async () => {
    const res = await request(app)
      .post("/api/ai/revisar-evolucao")
      .set(auth)
      .send({ evolutionText: "curto" });
    expect(res.status).toBe(400);
  });

  it("503 quando a IA não está configurada", async () => {
    aiMock.json.mockRejectedValueOnce(new AIUnavailableError());
    const res = await request(app)
      .post("/api/ai/extrair-clinica-medica")
      .set(auth)
      .send({ inputText: "x" });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe("ai_unavailable");
  });

  it("502 quando a IA devolve JSON fora do schema", async () => {
    aiMock.json.mockResolvedValueOnce({
      ok: false,
      error: "JSON da IA fora do schema esperado.",
      raw: "{}",
    });
    const res = await request(app).post("/api/ai/extrair-uti").set(auth).send({ inputText: "x" });
    expect(res.status).toBe(502);
    expect(res.body.error).toBe("ai_invalid_response");
  });

  it("nunca devolve pacientes fictícios quando a IA não identifica ninguém", async () => {
    aiMock.json.mockResolvedValueOnce({ ok: true, data: { patients: [], globalAlerts: [] } });
    const res = await request(app)
      .post("/api/ai/extrair-clinica-medica")
      .set(auth)
      .send({ inputText: "texto sem pacientes" });
    expect(res.status).toBe(200);
    expect(res.body.patients).toEqual([]);
    expect(res.body.globalAlerts).toContain("IA NÃO IDENTIFICOU PACIENTES NO TEXTO");
  });

  it("guardrails adicionam alerta crítico para K 5,7 na extração", async () => {
    const res = await request(app)
      .post("/api/ai/extrair-clinica-medica")
      .set(auth)
      .send({ inputText: "x" });
    const l02 = res.body.patients.find((p: { leito: string }) => p.leito === "L02");
    expect(l02.alertas.some((a: string) => a.includes("[CRÍTICO]") && a.includes("POTÁSSIO"))).toBe(
      true,
    );
    expect(res.body.globalAlerts.some((a: string) => a.startsWith("L02:"))).toBe(true);
  });

  it("aliases legados respondem com header Deprecation", async () => {
    const res = await request(app)
      .post("/api/ai/evolution-reviewer")
      .set(auth)
      .send({ evolutionText: "EVOLUCAO MEDICA PACIENTE ESTAVEL SEM QUEIXAS" });
    expect(res.status).toBe(200);
    expect(res.headers.deprecation).toBe("true");
  });

  it("aceita raw_notes na geração de evolução", async () => {
    // O Zod usa `strip`: um campo fora do schema é descartado em silêncio,
    // e o ditado do médico sumiria sem nenhum erro visível.
    const res = await request(app)
      .post("/api/ai/gerar-evolucao")
      .set(auth)
      .send({
        patient: { name: "X" },
        raw_notes: "PACIENTE REFERE MELHORA DA DISPNEIA, ACEITANDO DIETA.",
      });
    expect(res.status).toBe(200);
    expect(EvolucaoBody.parse({ patient: {}, raw_notes: "abc" }).raw_notes).toBe("abc");
  });

  it("rejeita raw_notes acima do limite", async () => {
    const res = await request(app)
      .post("/api/ai/gerar-evolucao")
      .set(auth)
      .send({ patient: { name: "X" }, raw_notes: "a".repeat(20_001) });
    expect(res.status).toBe(400);
  });

  it("404 JSON para rota de API inexistente", async () => {
    const res = await request(app).get("/api/nada").set(auth);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("not_found");
  });

  it("/health é público e informa o estado", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.jobStore).toBe("memory");
  });
});
