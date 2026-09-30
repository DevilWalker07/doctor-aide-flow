import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetAiMock, supabaseEstado } from "./helpers/mocks.js";
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

  /**
   * O campo `supabase` já foi `hasSupabase()` — só dizia se as variáveis de
   * ambiente existiam. Com isso ele respondia `true` em produção enquanto a
   * tabela `extraction_jobs` simplesmente não existia lá, e a passagem de
   * plantão morria no `jobStore.create` sem nada ligando um fato ao outro.
   *
   * Agora é estado sondado. Estes casos existem para que ele não volte a ser
   * um "true" que não quer dizer nada.
   */
  describe("o campo supabase do /health diz o estado, não o palpite", () => {
    afterEach(() => {
      supabaseEstado.atual = "ok";
    });

    it("tabela ausente aparece como sem_tabela, não como true", async () => {
      supabaseEstado.atual = "sem_tabela";
      const res = await request(app).get("/api/health").expect(200);
      expect(res.body.supabase).toBe("sem_tabela");
    });

    it("chave revogada aparece como chave_invalida", async () => {
      supabaseEstado.atual = "chave_invalida";
      const res = await request(app).get("/api/health").expect(200);
      expect(res.body.supabase).toBe("chave_invalida");
    });

    it("tudo certo aparece como ok", async () => {
      const res = await request(app).get("/api/health").expect(200);
      expect(res.body.supabase).toBe("ok");
    });

    it("o estado do Supabase não derruba o /health", async () => {
      // /health que cai com o banco fora do ar não serve para diagnosticar
      // nada — e é exatamente quando mais precisa responder.
      supabaseEstado.atual = "inalcancavel";
      const res = await request(app).get("/api/health").expect(200);
      expect(res.body.supabase).toBe("inalcancavel");
      expect(res.body.ok).toBe(true);
    });
  });

  /**
   * Em produção a API inteira respondia 404: `api/[...rota].ts` só casava um
   * segmento, e todo endpoint real é aninhado (`/api/ai/copiloto`,
   * `/api/extract/preparar-upload`, `/api/ai/passagem-leito`). Só
   * `/api/health` escapava, por ter um segmento só.
   *
   * Quem entrega o caminho à função é o rewrite da Vercel, que nenhum teste
   * daqui exercita. Então a aplicação deixou de depender disso: responde
   * recebendo com ou sem o prefixo.
   */
  describe("o caminho chega normalizado, com ou sem /api", () => {
    it("responde a caminho aninhado com o prefixo", async () => {
      const res = await request(app)
        .post("/api/ai/copiloto")
        .send({ messages: [{ role: "user", content: "dose de dipirona" }] });
      expect(res.status).toBe(200);
    });

    it("responde ao mesmo caminho aninhado SEM o prefixo", async () => {
      const res = await request(app)
        .post("/ai/copiloto")
        .send({ messages: [{ role: "user", content: "dose de dipirona" }] });
      expect(res.status).toBe(200);
    });

    it("rota inexistente aninhada responde o 404 NOSSO, em JSON", async () => {
      // O defeito de produção era um 404 de texto puro, da borda da Vercel.
      // 404 nosso é legítimo; o da borda significa que a função nem rodou.
      const res = await request(app).get("/api/extract/nao-existe").expect(404);
      expect(res.body.error).toBe("not_found");
    });

    it("/health continua na raiz, sem virar /api/health", async () => {
      const res = await request(app).get("/health").expect(200);
      expect(res.body.service).toBe("medfluxo-motor-luan");
    });
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

  it("monta a passagem por leito — aninhada em /api/ai, como toda rota real", async () => {
    // Sem documento o erro é de entrada: prova que o handler é o de verdade.
    const res = await request(app).post("/api/ai/passagem-leito").send({}).expect(400);
    expect(res.body.error).toBe("validation");
  });

  it("o fluxo antigo da passagem não existe mais", async () => {
    await request(app).post("/api/passagem-plantao/gerar").send({}).expect(404);
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
