import { describe, expect, it } from "vitest";
import { aiFixtures } from "../../server/mocks/aiFixtures.js";
import {
  AlertaCriticoSchema,
  ClinicalExtractionOutputSchema,
  DocumentExtractionSchema,
  MotorLuanTextBody,
  PassagemBodySchema,
  PassagemPlantaoBatchSchema,
  PatientRowSchema,
  SugestaoReceitaSchema,
} from "../../server/schemas/ai.schemas.js";

describe("schemas de saída da IA", () => {
  it("todas as fixtures passam nos schemas", () => {
    expect(() => ClinicalExtractionOutputSchema.parse(aiFixtures.clinicaMedica)).not.toThrow();
    expect(() => DocumentExtractionSchema.parse(aiFixtures.documentExtraction)).not.toThrow();
    expect(() => PassagemPlantaoBatchSchema.parse(aiFixtures.passagemBatch)).not.toThrow();
    expect(() => SugestaoReceitaSchema.parse(aiFixtures.receita)).not.toThrow();
  });

  it("PatientRow: quadroAtual ganha prefixo canônico e _raciocinio é descartado", () => {
    expect(
      PatientRowSchema.parse({ leito: "L1", quadroAtual: "paciente bem", _raciocinio: "x" }),
    ).not.toHaveProperty("_raciocinio");
    expect(PatientRowSchema.parse({ leito: "L1", quadroAtual: "paciente bem" }).quadroAtual).toBe(
      "NÃO CLASSIFICADO — paciente bem",
    );
    expect(PatientRowSchema.parse({ leito: "L1", quadroAtual: "estavel - ok" }).quadroAtual).toBe(
      "ESTÁVEL — ok",
    );
    expect(PatientRowSchema.parse({ leito: "L1", quadroAtual: "CRÍTICO — MOF" }).quadroAtual).toBe(
      "CRÍTICO — MOF",
    );
    expect(PatientRowSchema.parse({ leito: "L1" }).quadroAtual).toBe(
      "NÃO CLASSIFICADO — NÃO REFERIDO",
    );
  });

  it("PatientRow: campos ausentes recebem fallbacks e di é limitado", () => {
    const row = PatientRowSchema.parse({
      leito: "L1",
      di: "999",
      alertasPendencias: null,
      atb: 12,
    });
    expect(row.di).toBeNull();
    expect(row.alertasPendencias).toBe("");
    expect(row.atb).toBe("12");
    expect(row.ultimoLab).toBe("Sem lab recente");
  });

  it("AlertaCritico: prioridade desconhecida vira !! URGENTE (fail-safe)", () => {
    expect(AlertaCriticoSchema.parse({ prioridade: "alta", acao: "x" }).prioridade).toBe(
      "!! URGENTE",
    );
    expect(AlertaCriticoSchema.parse({ prioridade: "hoje mesmo", acao: "x" }).prioridade).toBe(
      "! HOJE",
    );
    expect(AlertaCriticoSchema.parse({ prioridade: "social", acao: "x" }).prioridade).toBe(
      "PENDÊNCIA SOCIAL",
    );
    expect(() => AlertaCriticoSchema.parse({ prioridade: "!! URGENTE", acao: "" })).toThrow();
  });

  it("PassagemPlantaoBatch: pacientes inválidos rejeitam o lote; alertas inválidos viram []", () => {
    expect(() =>
      PassagemPlantaoBatchSchema.parse({ pacientes: "nao", alertasCriticos: [] }),
    ).toThrow();
    expect(
      PassagemPlantaoBatchSchema.parse({ pacientes: [], alertasCriticos: "nao" }).alertasCriticos,
    ).toEqual([]);
  });

  it("DocumentExtraction: coerção e limites", () => {
    const d = DocumentExtractionSchema.parse({
      idade: "88",
      sexo: "masculino",
      data_admissao: "12/09/2026",
      lista_de_problemas: "PAC",
    });
    expect(d.idade).toBe(88);
    expect(d.sexo).toBeNull();
    expect(d.data_admissao).toBeNull();
    expect(d.lista_de_problemas).toEqual(["PAC"]);
    expect(DocumentExtractionSchema.parse({ idade: 200 }).idade).toBeNull();
  });

  it("ClinicalPatient: id espelha leito e sexo normalizado", () => {
    const out = ClinicalExtractionOutputSchema.parse({
      patients: [{ leito: "L07", sexo: "f", alertas: "x" }],
    });
    expect(out.patients[0].id).toBe("L07");
    expect(out.patients[0].sexo).toBe("F");
    expect(out.patients[0].alertas).toEqual(["x"]);
  });
});

describe("schemas de request", () => {
  it("MotorLuanTextBody exige algum texto", () => {
    expect(MotorLuanTextBody.safeParse({}).success).toBe(false);
    expect(MotorLuanTextBody.safeParse({ inputText: "  " }).success).toBe(false);
    expect(MotorLuanTextBody.safeParse({ rawText: "ok" }).success).toBe(true);
  });
  it("PassagemBodySchema valida setor e data e é strict", () => {
    expect(PassagemBodySchema.parse({}).setor).toBe("CMF/CMM");
    expect(PassagemBodySchema.safeParse({ setor: "../x" }).success).toBe(false);
    expect(PassagemBodySchema.safeParse({ data: "2026-09-15" }).success).toBe(false);
    expect(PassagemBodySchema.safeParse({ data: "15/09/2026", extra: 1 }).success).toBe(false);
  });
});
