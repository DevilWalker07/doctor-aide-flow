import { describe, expect, it } from "vitest";
import {
  ACENTOS,
  acentoDo,
  ATALHOS_GLOBAIS,
  getLocal,
  LOCAIS,
  localLabel,
  tiposDeEvolucaoDisponiveis,
} from "../../src/lib/ambientes";

/**
 * `ambientes.ts` é a fonte única que telas, formulários e seeds leem. Um id
 * duplicado ou uma rota morta aqui quebra navegação em vários lugares de uma
 * vez, então as invariantes ficam travadas por teste.
 */
describe("catálogo de locais", () => {
  it("tem os dez locais na ordem da tela inicial", () => {
    expect(LOCAIS.map((l) => l.id)).toEqual([
      "ubs",
      "ps-adulto",
      "ps-pediatrico",
      "enfermaria-adulto",
      "enfermaria-clinica",
      "enfermaria-cirurgica",
      "ambulatorio-especialidade",
      "uti-adulto",
      "uti-pediatrica",
      "uti-neonatal",
    ]);
  });

  it("não repete id", () => {
    const ids = LOCAIS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("dá a todo local rótulo, descrição, tipo e o selo de disponibilidade", () => {
    for (const local of LOCAIS) {
      expect(local.label.trim()).not.toBe("");
      expect(local.descricao.trim()).not.toBe("");
      expect(local.tipoEvolucao).toMatch(/^[a-z_]+$/);
      // `implementado` precisa ser explícito: undefined seria lido como
      // "em breve" sem ninguém ter decidido isso.
      expect(typeof local.implementado).toBe("boolean");
    }
  });

  it("só marca como implementado o que tem template de evolução", () => {
    // Espelha as chaves de TEMPLATES em src/routes/evolucao.$id.tsx.
    const COM_TEMPLATE = new Set([
      "enfermaria_clinica",
      "enfermaria_pediatrica",
      "uti",
      "upa",
      "ubs",
    ]);
    for (const local of LOCAIS) {
      expect(local.implementado).toBe(COM_TEMPLATE.has(local.tipoEvolucao));
    }
  });

  it("dá a cada local ao menos um atalho, para nenhuma tela virar beco sem saída", () => {
    for (const local of LOCAIS) {
      expect(local.atalhos.length).toBeGreaterThan(0);
    }
  });

  it("aponta atalhos apenas para rotas absolutas do app", () => {
    const todos = [...LOCAIS.flatMap((l) => l.atalhos), ...ATALHOS_GLOBAIS];
    expect(todos.length).toBeGreaterThan(0);
    for (const atalho of todos) {
      expect(atalho.to).toMatch(/^\/[a-z-]+$/);
      expect(atalho.label.trim()).not.toBe("");
      expect(atalho.descricao.trim()).not.toBe("");
    }
  });

  it("tem acento definido para toda família usada", () => {
    for (const local of LOCAIS) {
      expect(ACENTOS[local.familia]).toBeDefined();
      // O acento precisa funcionar nos dois temas: cor clara e variante dark.
      expect(acentoDo(local).text).toContain("dark:");
    }
  });
});

describe("getLocal", () => {
  it("encontra local existente", () => {
    expect(getLocal("uti-adulto")?.label).toBe("UTI Adulto");
    expect(getLocal("uti-adulto")?.tipoEvolucao).toBe("uti");
  });

  it("devolve undefined para id inexistente ou ausente", () => {
    expect(getLocal("centro-cirurgico")).toBeUndefined();
    expect(getLocal(undefined)).toBeUndefined();
  });
});

describe("localLabel", () => {
  it("devolve o rótulo do local", () => {
    expect(localLabel("enfermaria-clinica")).toBe("Enfermaria Clínica");
  });

  it("devolve string vazia para local desconhecido", () => {
    expect(localLabel("inexistente")).toBe("");
  });
});

describe("tiposDeEvolucaoDisponiveis", () => {
  it("só devolve locais implementados", () => {
    expect(tiposDeEvolucaoDisponiveis().every((l) => l.implementado)).toBe(true);
  });

  it("deduplica por tipo de evolução", () => {
    const tipos = tiposDeEvolucaoDisponiveis().map((l) => l.tipoEvolucao);
    expect(new Set(tipos).size).toBe(tipos.length);
    // Enfermaria Adulto e Enfermaria Clínica compartilham enfermaria_clinica;
    // só o primeiro entra na seleção de setor.
    expect(tipos).toContain("enfermaria_clinica");
    expect(tipos.filter((t) => t === "enfermaria_clinica")).toHaveLength(1);
  });
});
