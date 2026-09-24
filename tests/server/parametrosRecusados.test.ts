import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Modelos novos recusam ajustes que os antigos aceitavam, um de cada vez:
 * primeiro `max_tokens`, depois `temperature`. Eu consertei o primeiro isolado
 * e o segundo apareceu na tentativa seguinte do médico — duas rodadas dele
 * gastas com o mesmo defeito de desenho.
 *
 * Estes testes cobrem o MECANISMO, não o parâmetro da vez: qualquer ajuste que
 * a API recusar pelo nome deve ser adaptado, e o que sustenta o contrato de
 * dado clínico nunca pode ser descartado.
 */
const chamadas: Record<string, unknown>[] = [];
/** Parâmetros que o modelo falso recusa, com o formato de mensagem da OpenAI. */
const recusados = new Set<string>();
/** 400 que não nomeia parâmetro nenhum. */
const erroGenerico = { ativo: false };

vi.mock("openai", () => {
  class FakeOpenAI {
    chat = {
      completions: {
        create: async (corpo: Record<string, unknown>) => {
          chamadas.push({ ...corpo });
          if (erroGenerico.ativo) {
            throw Object.assign(new Error("400 Invalid value for 'messages'."), { status: 400 });
          }
          for (const p of recusados) {
            if (p in corpo) {
              throw Object.assign(
                new Error(`400 Unsupported value: '${p}' does not support this with this model.`),
                { status: 400 },
              );
            }
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

const { chatCompletion, safeJsonCompletion, perfilAprendido, esquecerLimites } =
  await import("../../server/services/openaiClient.js");

const pedir = (modelo: string) =>
  chatCompletion("s", [{ role: "user", content: "oi" }], { modelo });

describe("parâmetro recusado pelo modelo", () => {
  beforeEach(() => {
    chamadas.length = 0;
    recusados.clear();
    erroGenerico.ativo = false;
    esquecerLimites();
  });

  it("modelo que recusa temperature: refaz sem ele e a resposta sai", async () => {
    recusados.add("temperature");
    expect(await pedir("m")).toBe("resposta");
    expect(chamadas[0]).toHaveProperty("temperature");
    expect(chamadas[1]).not.toHaveProperty("temperature");
    expect(perfilAprendido("m")?.omitir).toContain("temperature");
  });

  it("recusando temperature E o nome do limite, adapta os dois", async () => {
    recusados.add("temperature");
    recusados.add("max_completion_tokens");
    expect(await pedir("m")).toBe("resposta");
    const ultima = chamadas.at(-1)!;
    expect(ultima).not.toHaveProperty("temperature");
    expect(ultima).toHaveProperty("max_tokens");
    expect(perfilAprendido("m")?.limite).toBe("max_tokens");
  });

  it("aprende uma vez — a segunda chamada já vai certa, sem round-trip extra", async () => {
    recusados.add("temperature");
    await pedir("m");
    chamadas.length = 0;
    await pedir("m");
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]).not.toHaveProperty("temperature");
  });

  /**
   * O caso que não pode virar esperteza: sem `response_format` a IA devolve
   * texto livre, o schema rejeita, e o app ficaria reparando algo que nunca ia
   * validar. Quando a IA não pode cumprir o contrato, a chamada falha.
   */
  it("response_format recusado NÃO é descartado — o erro sobe", async () => {
    recusados.add("response_format");
    await expect(
      safeJsonCompletion("s", {}, (await import("zod")).z.object({}), { modelo: "m" }),
    ).rejects.toThrow();
    expect(perfilAprendido("m")?.omitir ?? []).not.toContain("response_format");
  });

  it("400 que não nomeia parâmetro sobe intacto", async () => {
    erroGenerico.ativo = true;
    await expect(pedir("m")).rejects.toThrow();
    expect(chamadas).toHaveLength(1);
  });

  it("modelo que recusa tudo não vira laço infinito", async () => {
    recusados.add("temperature");
    recusados.add("max_completion_tokens");
    recusados.add("max_tokens");
    await expect(pedir("m")).rejects.toThrow();
    // Com teto de adaptações, o número de chamadas é pequeno e finito.
    expect(chamadas.length).toBeLessThanOrEqual(5);
  });
});
