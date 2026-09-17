import { describe, expect, it } from "vitest";
import {
  modeloAgentes,
  modeloCopiloto,
  modeloVisao,
  modelosEmUso,
  env,
} from "../../server/config.js";

/**
 * Modelo por finalidade.
 *
 * O teste importa porque a falha aqui é silenciosa: se a variável não for lida,
 * a chamada continua respondendo — só responde com o modelo barato, e ninguém
 * percebe até um número vir errado da foto do prontuário.
 */
describe("modelo de IA por rota", () => {
  it("sem as variáveis específicas, tudo cai no OPENAI_MODEL", () => {
    expect(env.OPENAI_MODEL_VISAO).toBeUndefined();
    expect(env.OPENAI_MODEL_COPILOTO).toBeUndefined();
    expect(env.OPENAI_MODEL_AGENTES).toBeUndefined();
    expect(modeloVisao()).toBe(env.OPENAI_MODEL);
    expect(modeloCopiloto()).toBe(env.OPENAI_MODEL);
    expect(modeloAgentes()).toBe(env.OPENAI_MODEL);
    expect(modelosEmUso()).toEqual({
      padrao: env.OPENAI_MODEL,
      visao: env.OPENAI_MODEL,
      copiloto: env.OPENAI_MODEL,
      agentes: env.OPENAI_MODEL,
    });
  });

  it("com a variável definida, a rota usa o modelo próprio", () => {
    const original = { ...env };
    try {
      (env as { OPENAI_MODEL_VISAO?: string }).OPENAI_MODEL_VISAO = "modelo-de-visao";
      (env as { OPENAI_MODEL_COPILOTO?: string }).OPENAI_MODEL_COPILOTO = "modelo-de-copiloto";

      expect(modeloVisao()).toBe("modelo-de-visao");
      expect(modeloCopiloto()).toBe("modelo-de-copiloto");
      // O padrão não é contaminado: reformatar texto segue no modelo barato.
      expect(modelosEmUso().padrao).toBe(original.OPENAI_MODEL);
    } finally {
      (env as { OPENAI_MODEL_VISAO?: string }).OPENAI_MODEL_VISAO = original.OPENAI_MODEL_VISAO;
      (env as { OPENAI_MODEL_COPILOTO?: string }).OPENAI_MODEL_COPILOTO =
        original.OPENAI_MODEL_COPILOTO;
    }
  });
});
