import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A OpenAI trocou `max_tokens` por `max_completion_tokens` nos modelos novos.
 * Quem manda o antigo leva 400 — e em produção isso derrubou TODA chamada de
 * IA (passagem, copiloto, evolução, resumo de exames) depois de o arquivo já
 * ter subido e o texto já ter sido extraído.
 *
 * Não dá para resolver com lista de nomes de modelo: o identificador vem de
 * variável de ambiente e muda quando o médico troca de modelo. Por isso o
 * código descobre, e estes testes cobrem a descoberta.
 */
const chamadas: Record<string, unknown>[] = [];
/** Nome do parâmetro que o modelo falso recusa; null aceita os dois. */
const recusa = { parametro: null as string | null };
/** Faz o modelo falso devolver um 400 que NÃO é sobre o parâmetro. */
const erroGenerico = { ativo: false };

vi.mock("openai", () => {
  class FakeOpenAI {
    chat = {
      completions: {
        create: async (corpo: Record<string, unknown>) => {
          chamadas.push(corpo);
          if (erroGenerico.ativo) {
            throw Object.assign(new Error("400 Invalid value for 'temperature'."), { status: 400 });
          }
          if (recusa.parametro && recusa.parametro in corpo) {
            throw Object.assign(
              new Error(
                `400 Unsupported parameter: '${recusa.parametro}' is not supported with this model.`,
              ),
              { status: 400 },
            );
          }
          return {
            choices: [{ message: { content: "resposta" }, finish_reason: "stop" }],
            usage: { prompt_tokens: 1, completion_tokens: 1 },
          };
        },
      },
    };
  }
  return { default: FakeOpenAI };
});

process.env.OPENAI_API_KEY = "sk-teste";
process.env.AI_MOCK = "";

const { chatCompletion, limiteAprendido, esquecerLimites } =
  await import("../../server/services/openaiClient.js");

const usados = () => chamadas.map((c) => Object.keys(c).find((k) => k.includes("tokens")));

describe("limite de saída por modelo", () => {
  beforeEach(() => {
    chamadas.length = 0;
    recusa.parametro = null;
    erroGenerico.ativo = false;
    esquecerLimites();
  });

  it("começa pelo parâmetro novo, que é o dos modelos atuais", async () => {
    await chatCompletion("s", [{ role: "user", content: "oi" }], { modelo: "modelo-novo" });
    expect(usados()).toEqual(["max_completion_tokens"]);
    expect(limiteAprendido("modelo-novo")).toBe("max_completion_tokens");
  });

  it("modelo antigo: recusa o novo e a chamada é refeita com max_tokens", async () => {
    recusa.parametro = "max_completion_tokens";
    const texto = await chatCompletion("s", [{ role: "user", content: "oi" }], {
      modelo: "modelo-antigo",
    });
    // Não propaga o erro: a resposta sai.
    expect(texto).toBe("resposta");
    expect(usados()).toEqual(["max_completion_tokens", "max_tokens"]);
    expect(limiteAprendido("modelo-antigo")).toBe("max_tokens");
  });

  it("aprende uma vez só — a segunda chamada já vai direto", async () => {
    recusa.parametro = "max_completion_tokens";
    await chatCompletion("s", [{ role: "user", content: "a" }], { modelo: "modelo-antigo" });
    chamadas.length = 0;
    await chatCompletion("s", [{ role: "user", content: "b" }], { modelo: "modelo-antigo" });
    expect(usados()).toEqual(["max_tokens"]);
  });

  it("erro 400 que NÃO é sobre o parâmetro sobe — não vira retentativa cega", async () => {
    erroGenerico.ativo = true;
    await expect(
      chatCompletion("s", [{ role: "user", content: "oi" }], { modelo: "m" }),
    ).rejects.toThrow();
    expect(usados()).toEqual(["max_completion_tokens"]);
  });
});
