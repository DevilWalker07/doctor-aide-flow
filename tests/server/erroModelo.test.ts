import { describe, expect, it } from "vitest";
import { AIUnavailableError, HttpError, ModeloIndisponivelError } from "../../server/lib/errors.js";

/** Reproduz o erro que o SDK da OpenAI lança, sem chamar a rede. */
function erroApi(status: number, extra: Record<string, unknown> = {}) {
  return Object.assign(new Error(`status ${status}`), { status, ...extra });
}

describe("erro de modelo configurado errado", () => {
  it("nomeia o modelo recusado e a variável a conferir", () => {
    const err = new ModeloIndisponivelError(
      "GPT-5.6 Luna",
      "a OpenAI não reconhece esse identificador.",
    );
    expect(err.status).toBe(503);
    expect(err.code).toBe("modelo_indisponivel");
    // O erro mais provável ao trocar de modelo é colar o nome de exibição.
    expect(err.message).toContain("GPT-5.6 Luna");
    expect(err.message).toContain("OPENAI_MODEL");
    expect(err.message).toMatch(/ID da API, não o nome de exibição/);
  });

  it("traduz 404, 403, 401 e 429 em vez de virar 500 genérico", async () => {
    const { traduzirErroOpenAI } = await import("../../server/services/openaiClient.js");

    const pegar = (err: unknown) => {
      try {
        traduzirErroOpenAI(err, "modelo-x");
      } catch (e) {
        return e as HttpError;
      }
      throw new Error("traduzirErroOpenAI deveria sempre lançar");
    };

    expect(pegar(erroApi(404)).code).toBe("modelo_indisponivel");
    expect(pegar(erroApi(200, { code: "model_not_found" })).code).toBe("modelo_indisponivel");
    expect(pegar(erroApi(403)).code).toBe("modelo_indisponivel");
    expect(pegar(erroApi(401)).code).toBe("chave_invalida");
    expect(pegar(erroApi(429)).code).toBe("limite_openai");

    // Sem crédito e "muitas chamadas" são problemas diferentes e a mensagem
    // precisa dizer qual é — um você resolve com cartão, o outro esperando.
    const semCredito = pegar(
      Object.assign(new Error("You exceeded your current quota"), { status: 429 }),
    );
    expect(semCredito.message).toMatch(/sem crédito/i);
    expect(pegar(erroApi(429)).message).toMatch(/instantes/i);

    // 400 com imagem é o caso do OPENAI_MODEL_VISAO apontando para um modelo
    // que só aceita texto: o ID existe, o /health não reclama, e só a leitura
    // de foto quebra. Sem imagem, 400 não é diagnóstico nosso e sobe intacto.
    const semImagem = erroApi(400);
    expect(() => traduzirErroOpenAI(semImagem, "modelo-x")).toThrow(semImagem);

    let comImagem: HttpError | undefined;
    try {
      traduzirErroOpenAI(erroApi(400), "modelo-x", true);
    } catch (e) {
      comImagem = e as HttpError;
    }
    expect(comImagem?.code).toBe("modelo_indisponivel");
    expect(comImagem?.message).toMatch(/OPENAI_MODEL_VISAO/);
    expect(comImagem?.message).toMatch(/imagem na entrada/);

    // O que não é da API continua subindo intacto: inventar tradução para
    // erro desconhecido esconderia a causa real.
    const outro = new Error("socket hang up");
    expect(() => traduzirErroOpenAI(outro, "modelo-x")).toThrow(outro);
    expect(pegar(erroApi(500))).not.toBeInstanceOf(ModeloIndisponivelError);
  });

  it("sem chave, o erro continua sendo o de IA indisponível", () => {
    const err = new AIUnavailableError();
    expect(err.status).toBe(503);
    expect(err.code).toBe("ai_unavailable");
  });
});
