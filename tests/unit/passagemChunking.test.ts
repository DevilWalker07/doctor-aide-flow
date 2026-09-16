import { describe, expect, it } from "vitest";
import { PassagemPlantaoBatchSchema } from "../../server/schemas/ai.schemas.js";
import { applyLabGuardrails, chunkEvolucoes, mergeBatchResults, normalizeLeito } from "../../server/services/passagemPlantao.service.js";

const item = (n: number, size = 100) => ({ fileName: `ev${n}.txt`, text: "x".repeat(size) });

describe("chunkEvolucoes", () => {
  it("respeita o máximo de itens por lote", () => {
    const batches = chunkEvolucoes(Array.from({ length: 8 }, (_, i) => item(i)));
    expect(batches.map((b) => b.length)).toEqual([6, 2]);
  });
  it("respeita o máximo de caracteres por lote", () => {
    const batches = chunkEvolucoes([item(1, 7000), item(2, 7000), item(3, 1000)], { maxCharsPerBatch: 12_000 });
    expect(batches.map((b) => b.length)).toEqual([1, 2]);
  });
  it("trunca itens gigantes", () => {
    const [batch] = chunkEvolucoes([item(1, 50_000)], { maxCharsPerItem: 20_000 });
    expect(batch[0].text.length).toBe(20_000);
  });
  it("lista vazia → nenhum lote", () => {
    expect(chunkEvolucoes([])).toEqual([]);
  });
});

describe("mergeBatchResults", () => {
  const row = (leito: string, extra: Partial<Record<string, unknown>> = {}) => PassagemPlantaoBatchSchema.parse({ pacientes: [{ leito, ...extra }], alertasCriticos: [] }).pacientes[0];

  it("normaliza leitos e ordena numericamente", () => {
    expect(normalizeLeito("cmf 03")).toBe("CMF03");
    expect(normalizeLeito("12")).toBe("L12");
    const merged = mergeBatchResults([
      { pacientes: [row("L10"), row("L2")], alertasCriticos: [] },
      { pacientes: [row("L1"), row("L2", { paciente: "DUP" })], alertasCriticos: [] },
    ]);
    expect(merged.pacientes.map((p) => p.leito)).toEqual(["L1", "L2", "L10"]);
    expect(merged.pacientes[1].paciente).toBe("NÃO REFERIDO");
  });

  it("deduplica alertas por (leito, ação)", () => {
    const a = { prioridade: "!! URGENTE" as const, leito: "L1", paciente: "X", acao: "Repetir K" };
    const merged = mergeBatchResults([
      { pacientes: [], alertasCriticos: [a] },
      { pacientes: [], alertasCriticos: [{ ...a, acao: "repetir k" }, { ...a, acao: "Outra" }] },
    ]);
    expect(merged.alertasCriticos).toHaveLength(2);
  });
});

describe("applyLabGuardrails", () => {
  it("insere !! na linha e alerta urgente para lab crítico, sem duplicar", () => {
    const base = PassagemPlantaoBatchSchema.parse({
      pacientes: [{ leito: "L5", paciente: "A", ultimoLab: "K 6,2 / CR 1,0", alertasPendencias: "! RX pendente" }],
      alertasCriticos: [],
    });
    const once = applyLabGuardrails(base);
    expect(once.pacientes[0].alertasPendencias.startsWith("!! LAB CRÍTICO: Potássio 6,2")).toBe(true);
    expect(once.alertasCriticos).toHaveLength(1);
    expect(once.alertasCriticos[0]).toMatchObject({ prioridade: "!! URGENTE", leito: "L5" });
    const twice = applyLabGuardrails(once);
    expect(twice.alertasCriticos).toHaveLength(1);
    expect(twice.pacientes[0].alertasPendencias.match(/LAB CRÍTICO/g)).toHaveLength(1);
  });
  it("não altera linhas com lab normal", () => {
    const base = PassagemPlantaoBatchSchema.parse({ pacientes: [{ leito: "L1", ultimoLab: "HB 12 / K 4,0" }], alertasCriticos: [] });
    expect(applyLabGuardrails(base)).toEqual(base);
  });
});
