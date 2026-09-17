import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetAiMock } from "./helpers/mocks.js";
import { configErrors } from "../../server/config.js";
import { createServerlessApp } from "../../server/serverless.js";

const app = createServerlessApp();

/** Simula ambiente mal configurado — é exatamente o mecanismo do 503. */
function comConfigQuebrada(motivo: string) {
  configErrors.push(motivo);
  return () => {
    configErrors.length = 0;
  };
}

beforeEach(() => {
  resetAiMock();
});

afterEach(() => {
  configErrors.length = 0;
});

describe("função serverless da Vercel", () => {
  it("responde /api/health sem exigir token", async () => {
    const res = await request(app).get("/api/health").expect(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.runtime).toBe("vercel-function");
    expect(res.body.configErrors).toEqual([]);
  });

  it("responde /health também, porque o contêiner serve na raiz", async () => {
    await request(app).get("/health").expect(200);
  });

  it("monta o mesmo aiRouter do contêiner", async () => {
    const res = await request(app)
      .post("/api/ai/copiloto")
      .send({ messages: [{ role: "user", content: "dose de dipirona" }] })
      .expect(200);
    expect(typeof res.body).toBe("object");
  });

  it("devolve 404 em JSON para rota de API inexistente", async () => {
    const res = await request(app).post("/api/ai/nao-existe").send({}).expect(404);
    expect(res.body.error).toBe("not_found");
  });

  it("monta a rota de extração — o upload vai direto ao Storage", async () => {
    const res = await request(app).post("/api/extract/extract-async").send({}).expect(400);
    expect(res.body.error).toBe("missing_storage_path");
  });

  it("diz que a passagem de plantão ainda não está nesta implantação", async () => {
    const res = await request(app).post("/api/passagem-plantao").expect(503);
    expect(res.body.error).toBe("rota_indisponivel");
  });

  it("sem configuração completa responde 503 com o motivo, em vez de morrer", async () => {
    const restaurar = comConfigQuebrada("OPENAI_API_KEY ausente");

    const health = await request(app).get("/api/health").expect(503);
    expect(health.body.ok).toBe(false);
    expect(health.body.configErrors).toContain("OPENAI_API_KEY ausente");

    const chamada = await request(app)
      .post("/api/ai/copiloto")
      .send({ messages: [{ role: "user", content: "x" }] })
      .expect(503);
    expect(chamada.body.error).toBe("config_indisponivel");
    expect(chamada.body.details).toContain("OPENAI_API_KEY ausente");

    restaurar();
  });
});
