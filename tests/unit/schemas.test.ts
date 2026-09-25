import { describe, expect, it } from "vitest";
import { aiFixtures } from "../../server/mocks/aiFixtures.js";
import {
  ClinicalExtractionOutputSchema,
  ConsolidacaoSchema,
  DocumentExtractionSchema,
  MotorLuanTextBody,
  PassagemLeitoBody,
  PassagemLeitoSchema,
  SugestaoReceitaSchema,
  TranscricaoSchema,
} from "../../server/schemas/ai.schemas.js";

describe("schemas de saída da IA", () => {
  it("todas as fixtures passam nos schemas", () => {
    expect(() => ClinicalExtractionOutputSchema.parse(aiFixtures.clinicaMedica)).not.toThrow();
    expect(() => DocumentExtractionSchema.parse(aiFixtures.documentExtraction)).not.toThrow();
    expect(() => TranscricaoSchema.parse(aiFixtures.transcricao())).not.toThrow();
    expect(() => SugestaoReceitaSchema.parse(aiFixtures.receita)).not.toThrow();
  });

  it("linha do leito: quadroAtual ganha prefixo canônico e _raciocinio é descartado", () => {
    const q = (quadroAtual?: string) => PassagemLeitoSchema.parse({ quadroAtual }).quadroAtual;
    expect(PassagemLeitoSchema.parse({ quadroAtual: "x", _raciocinio: "x" })).not.toHaveProperty(
      "_raciocinio",
    );
    expect(q("paciente bem")).toBe("NÃO CLASSIFICADO — paciente bem");
    expect(q("estavel - ok")).toBe("ESTÁVEL — ok");
    expect(q("CRÍTICO — MOF")).toBe("CRÍTICO — MOF");
    expect(q()).toBe("NÃO CLASSIFICADO — NÃO REFERIDO");
  });

  it("linha do leito: campos ausentes recebem fallbacks; identificação ausente vira nulos", () => {
    const row = PassagemLeitoSchema.parse({ alertasPendencias: null, atb: 12, identificacao: "x" });
    expect(row.alertasPendencias).toBe("");
    expect(row.atb).toBe("12");
    expect(row.ultimoLab).toBe("Sem lab recente");
    expect(row.identificacao).toMatchObject({ nome: null, leito: null, conflitos: [] });
  });

  it("prioridade desconhecida vira !! URGENTE (fail-safe); alerta sem ação é recusado", () => {
    const p = (prioridade: string) =>
      PassagemLeitoSchema.parse({ alertasCriticos: [{ prioridade, acao: "x" }] }).alertasCriticos[0]
        .prioridade;
    expect(p("alta")).toBe("!! URGENTE");
    expect(p("hoje mesmo")).toBe("! HOJE");
    expect(p("social")).toBe("PENDÊNCIA SOCIAL");
    expect(
      PassagemLeitoSchema.parse({ alertasCriticos: [{ prioridade: "!! URGENTE", acao: "" }] })
        .alertasCriticos,
    ).toEqual([]);
  });

  it("transcrição exige markdown e mantém [ilegível] como veio", () => {
    expect(() => TranscricaoSchema.parse({ trechos_ilegiveis: [] })).toThrow();
    expect(TranscricaoSchema.parse({ markdown: "K [ilegível]" }).markdown).toBe("K [ilegível]");
  });

  it("consolidação sem pendências é recusada — o DOCX mostra a falha, não lista vazia", () => {
    expect(() => ConsolidacaoSchema.parse({ prioridades: [] })).toThrow();
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
  it("PassagemLeitoBody valida data e é strict", () => {
    const base = { markdown: "EVOLUÇÃO MÉDICA — PACIENTE ESTÁVEL", arquivo: "L01.docx" };
    expect(PassagemLeitoBody.safeParse({ ...base, dataPlantao: "25/09/2026" }).success).toBe(true);
    expect(PassagemLeitoBody.safeParse({ ...base, dataPlantao: "2026-09-25" }).success).toBe(false);
    expect(
      PassagemLeitoBody.safeParse({ ...base, dataPlantao: "25/09/2026", extra: 1 }).success,
    ).toBe(false);
  });
});
