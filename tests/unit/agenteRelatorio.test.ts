import { describe, expect, it } from "vitest";
import {
  ItemSchema,
  RelatorioSchema,
  ordenar,
  paraMarkdown,
  type RelatorioGravado,
} from "../../scripts/agentes/lib/relatorio.js";

const base = {
  id: "corrigir-alguma-coisa",
  titulo: "Corrigir alguma coisa concreta",
  categoria: "confiabilidade" as const,
  prioridade: 2,
  problema: "Um problema descrito com evidência suficiente para conferir.",
  proposta: "Uma proposta concreta o bastante para alguém implementar hoje.",
  arquivos: ["src/lib/x.ts"],
  criterio_de_aceite: ["O teste tal passa"],
  esforco: "pequeno" as const,
};

describe("schema do relatório", () => {
  it("exige id usável como nome de branch", () => {
    // O id vira `agente/<id>`: espaço, acento e maiúscula quebrariam o git.
    for (const id of ["Com Espaco", "com-Acento-é", "COM-MAIUSCULA", "-comeca-com-hifen", "a"]) {
      expect(ItemSchema.safeParse({ ...base, id }).success, id).toBe(false);
    }
    expect(ItemSchema.safeParse({ ...base, id: "kebab-case-ok-123" }).success).toBe(true);
  });

  it("exige critério de aceite — sem isso não há como saber que ficou pronto", () => {
    expect(ItemSchema.safeParse({ ...base, criterio_de_aceite: [] }).success).toBe(false);
  });

  it("recusa categoria e prioridade fora da faixa", () => {
    expect(ItemSchema.safeParse({ ...base, categoria: "refactor" }).success).toBe(false);
    expect(ItemSchema.safeParse({ ...base, prioridade: 0 }).success).toBe(false);
    expect(ItemSchema.safeParse({ ...base, prioridade: 9 }).success).toBe(false);
  });

  it("exige_revisao_humana entra como false quando ausente", () => {
    const r = ItemSchema.parse(base);
    expect(r.exige_revisao_humana).toBe(false);
  });

  it("recusa relatório sem item nenhum", () => {
    expect(RelatorioSchema.safeParse({ resumo: "x".repeat(30), itens: [] }).success).toBe(false);
  });
});

describe("ordenação e markdown", () => {
  it("prioridade manda; empate desempata por categoria, segurança primeiro", () => {
    const itens = [
      { ...base, id: "dx-p1", categoria: "dx" as const, prioridade: 1 },
      { ...base, id: "seg-p1", categoria: "seguranca" as const, prioridade: 1 },
      { ...base, id: "seg-p3", categoria: "seguranca" as const, prioridade: 3 },
    ].map((i) => ItemSchema.parse(i));

    expect(ordenar(itens).map((i) => i.id)).toEqual(["seg-p1", "dx-p1", "seg-p3"]);
  });

  it("o markdown marca o que não é delegável e não oferece o comando para ele", () => {
    const relatorio: RelatorioGravado = {
      resumo: "Resumo suficientemente longo para o schema aceitar.",
      itens: [
        ItemSchema.parse({ ...base, id: "pode-delegar" }),
        ItemSchema.parse({
          ...base,
          id: "nao-delegar",
          categoria: "seguranca",
          exige_revisao_humana: true,
        }),
      ],
      gerado_em: "2026-09-17T00:00:00.000Z",
      commit: "abc123",
      modelo: "modelo-teste",
    };

    const md = paraMarkdown(relatorio);
    expect(md).toContain("npm run agente:implementar -- --id pode-delegar");
    // O que exige revisão humana não vem com o comando ao lado: oferecer o
    // atalho é convidar a usá-lo.
    expect(md).not.toContain("--id nao-delegar");
    expect(md).toContain("Implementação manual.");
    expect(md).toContain("⚑");
    // O relatório diz o que é: leitura de um modelo, não verdade.
    expect(md).toMatch(/vale como pauta, não como verdade/);
  });
});
