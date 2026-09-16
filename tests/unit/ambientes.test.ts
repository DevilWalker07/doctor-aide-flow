import { describe, expect, it } from "vitest";
import {
  AMBIENTES,
  ambienteLabel,
  ATALHOS_GLOBAIS,
  getAmbiente,
  getSubAmbiente,
} from "../../src/lib/ambientes";

/**
 * `ambientes.ts` é a fonte única que telas, formulários e seeds leem.
 * Um id duplicado ou uma rota morta aqui quebra navegação em vários lugares
 * de uma vez, então as invariantes ficam travadas por teste.
 */
describe("catálogo de ambientes", () => {
  it("tem os cinco ambientes de atendimento", () => {
    expect(AMBIENTES.map((a) => a.id)).toEqual([
      "pronto-socorro",
      "enfermaria",
      "uti",
      "ambulatorio",
      "ubs",
    ]);
  });

  it("não repete id de ambiente nem de subambiente", () => {
    const ambienteIds = AMBIENTES.map((a) => a.id);
    expect(new Set(ambienteIds).size).toBe(ambienteIds.length);

    const subIds = AMBIENTES.flatMap((a) => a.subs.map((s) => s.id));
    expect(new Set(subIds).size).toBe(subIds.length);
  });

  it("dá a todo subambiente rótulo, descrição, tipo de evolução e o selo de disponibilidade", () => {
    for (const ambiente of AMBIENTES) {
      expect(ambiente.subs.length).toBeGreaterThan(0);
      for (const sub of ambiente.subs) {
        expect(sub.label.trim()).not.toBe("");
        expect(sub.descricao.trim()).not.toBe("");
        expect(sub.tipoEvolucao).toMatch(/^[a-z_]+$/);
        // `implementado` precisa ser explícito: undefined seria lido como
        // "em breve" sem ninguém ter decidido isso.
        expect(typeof sub.implementado).toBe("boolean");
      }
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
    for (const sub of AMBIENTES.flatMap((a) => a.subs)) {
      expect(sub.implementado).toBe(COM_TEMPLATE.has(sub.tipoEvolucao));
    }
  });

  it("aponta atalhos apenas para rotas absolutas do app", () => {
    const todos = [...AMBIENTES.flatMap((a) => a.atalhos), ...ATALHOS_GLOBAIS];
    expect(todos.length).toBeGreaterThan(0);
    for (const atalho of todos) {
      expect(atalho.to).toMatch(/^\/[a-z-]+$/);
      expect(atalho.label.trim()).not.toBe("");
      expect(atalho.descricao.trim()).not.toBe("");
    }
  });

  it("dá a cada ambiente ao menos um atalho, para nenhuma tela virar beco sem saída", () => {
    for (const ambiente of AMBIENTES) {
      expect(ambiente.atalhos.length).toBeGreaterThan(0);
    }
  });
});

describe("busca por id", () => {
  it("encontra ambiente e subambiente existentes", () => {
    expect(getAmbiente("enfermaria")?.curto).toBe("Enfermaria");
    expect(getSubAmbiente("enfermaria", "clinica-medica")?.tipoEvolucao).toBe("enfermaria_clinica");
  });

  it("devolve undefined para id inexistente ou ausente", () => {
    expect(getAmbiente("centro-cirurgico")).toBeUndefined();
    expect(getAmbiente(undefined)).toBeUndefined();
    expect(getSubAmbiente("enfermaria", "inexistente")).toBeUndefined();
    // subambiente que existe, mas em outro ambiente
    expect(getSubAmbiente("uti", "clinica-medica")).toBeUndefined();
  });
});

describe("ambienteLabel", () => {
  it("junta ambiente e subambiente quando os dois existem", () => {
    expect(ambienteLabel("enfermaria", "clinica-medica")).toBe("Enfermaria · Clínica Médica");
  });

  it("usa o nome completo do ambiente quando não há subambiente", () => {
    expect(ambienteLabel("uti", undefined)).toBe("Unidade de Terapia Intensiva");
  });

  it("ignora subambiente que não pertence ao ambiente", () => {
    expect(ambienteLabel("uti", "clinica-medica")).toBe("Unidade de Terapia Intensiva");
  });

  it("devolve string vazia para ambiente desconhecido", () => {
    expect(ambienteLabel("inexistente", "clinica-medica")).toBe("");
  });
});
