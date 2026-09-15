import { z } from "zod";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const str = (fallback = "") =>
  z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v) => (v == null ? fallback : String(v).trim() || fallback))
    .catch(fallback);

const strArr = z
  .union([z.array(z.unknown()), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null) return [] as string[];
    const arr = Array.isArray(v) ? v : [v];
    return arr.map((x) => String(x ?? "").trim()).filter(Boolean);
  })
  .catch([] as string[]);

const nullableStr = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => (v == null || String(v).trim() === "" ? null : String(v).trim()))
  .catch(null);

export const todayBR = () => new Date().toLocaleDateString("pt-BR");

// ─── Request bodies ──────────────────────────────────────────────────────────

export const MotorLuanTextBody = z
  .object({
    inputText: z.string().optional(),
    rawText: z.string().optional(),
    text: z.string().optional(),
    patientContext: z.unknown().optional(),
    context: z.unknown().optional(),
    task: z.string().optional(),
  })
  .refine((b) => Boolean(b.inputText?.trim() || b.rawText?.trim() || b.text?.trim()), {
    message: "Informe inputText, rawText ou text.",
  });
export type MotorLuanTextBody = z.infer<typeof MotorLuanTextBody>;

export const RoundBody = z.object({
  patients: z.array(z.record(z.unknown())).default([]),
  sector: z.string().default("CLÍNICA MÉDICA"),
  date: z.string().default(todayBR),
});
export type RoundBody = z.infer<typeof RoundBody>;

export const EvolucaoBody = z.object({
  patient: z.record(z.unknown()),
  tipo_unidade: z.string().optional(),
  template: z.string().optional(),
  data_plantao: z.string().optional(),
  preferences: z
    .object({
      uppercase: z.boolean().optional(),
      lab_format: z.string().optional(),
      atb_day_rule: z.string().optional(),
    })
    .partial()
    .optional(),
});
export type EvolucaoBody = z.infer<typeof EvolucaoBody>;

export const EvolutionReviewBody = z.object({
  evolutionText: z.string().min(20, "Texto da evolução muito curto."),
  patient: z.record(z.unknown()).optional(),
});
export type EvolutionReviewBody = z.infer<typeof EvolutionReviewBody>;

export const EncaminhamentoBody = z.object({
  patient: z.record(z.unknown()),
  destinations: z.array(z.string()).default([]),
  specialty: z.string().nullable().optional(),
  specialist_name: z.string().nullable().optional(),
  regulacao_dest: z.string().nullable().optional(),
  reason: z.string().min(3),
  hypotheses: z.array(z.string()).optional(),
  data_plantao: z.string().optional(),
});
export type EncaminhamentoBody = z.infer<typeof EncaminhamentoBody>;

export const SugerirReceitaBody = z.object({
  patient: z.record(z.unknown()),
  itensAtuais: z.array(z.record(z.unknown())).default([]),
  catalogo: z.array(z.object({ id: z.string(), nome: z.string(), apresentacao: z.string() })).default([]),
});
export type SugerirReceitaBody = z.infer<typeof SugerirReceitaBody>;

export const PassagemBodySchema = z
  .object({
    setor: z
      .string()
      .trim()
      .min(1)
      .max(40)
      .regex(/^[\p{L}\p{N} /-]+$/u, "Setor contém caracteres inválidos.")
      .default("CMF/CMM"),
    data: z
      .string()
      .regex(/^\d{2}\/\d{2}\/\d{4}$/, "Data deve estar no formato DD/MM/AAAA.")
      .default(todayBR),
  })
  .strict();
export type PassagemBody = z.infer<typeof PassagemBodySchema>;

// ─── AI outputs ──────────────────────────────────────────────────────────────

export const ClinicalPatientSchema = z
  .object({
    leito: str("LEITO NÃO IDENTIFICADO"),
    nome: str("NÃO REFERIDO"),
    idade: str(""),
    sexo: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((v) => {
        const s = String(v ?? "").trim().toUpperCase();
        return s === "M" || s === "F" ? s : "";
      })
      .catch(""),
    diagnosticos: str(""),
    comorbidades: str(""),
    dispositivos: str(""),
    antibioticos: str(""),
    laboratorio: str(""),
    quadro: str(""),
    intercorrencias: str(""),
    pendencias: str(""),
    alertas: strArr,
  })
  .transform((p) => ({ id: p.leito, ...p }));
export type ClinicalPatient = z.infer<typeof ClinicalPatientSchema>;

export const ClinicalExtractionOutputSchema = z.object({
  patients: z.array(ClinicalPatientSchema).catch([]),
  globalAlerts: strArr,
});
export type ClinicalExtractionOutput = z.infer<typeof ClinicalExtractionOutputSchema>;

export const OrquestradorOutputSchema = z.object({
  agent: z
    .enum(["orquestrador", "clinica-medica", "pediatria", "uti", "gerador-evolucao", "mapa-plantao", "briefing"])
    .catch("clinica-medica"),
  patients: z.array(ClinicalPatientSchema).catch([]),
  globalAlerts: strArr,
  raw: z.unknown().optional(),
});
export type OrquestradorOutput = z.infer<typeof OrquestradorOutputSchema>;

export const DocumentExtractionSchema = z.object({
  nome: nullableStr,
  idade: z.coerce.number().int().min(0).max(130).nullable().catch(null),
  sexo: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => {
      const s = String(v ?? "").trim().toUpperCase();
      return s === "M" || s === "F" ? (s as "M" | "F") : null;
    })
    .catch(null),
  leito: nullableStr,
  setor: nullableStr,
  data_admissao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().catch(null),
  hda: nullableStr,
  lista_de_problemas: strArr,
  antibioticos: strArr,
  medicacoes: strArr,
  laboratorios: strArr,
  exame_fisico: nullableStr,
  condutas: strArr,
  pendencias: strArr,
  alertas: strArr,
});
export type DocumentExtraction = z.infer<typeof DocumentExtractionSchema>;

export const PRIORIDADES = ["!! URGENTE", "! HOJE", "PENDÊNCIA SOCIAL", "PALIATIVO"] as const;
export const PrioridadeEnum = z.enum(PRIORIDADES);
export type Prioridade = z.infer<typeof PrioridadeEnum>;

function normalizePrioridade(v: unknown): Prioridade {
  const s = String(v ?? "").toUpperCase();
  if (s.includes("URGENTE")) return "!! URGENTE";
  if (s.includes("HOJE")) return "! HOJE";
  if (s.includes("SOCIAL")) return "PENDÊNCIA SOCIAL";
  if (s.includes("PALIATIV")) return "PALIATIVO";
  return "!! URGENTE";
}

export const PatientRowSchema = z.object({
  leito: str("LEITO NÃO IDENTIFICADO"),
  paciente: str("NÃO REFERIDO"),
  dih: str("NÃO REFERIDO"),
  di: z.coerce.number().int().min(0).max(400).nullable().catch(null),
  diagnostico: str("NÃO REFERIDO"),
  quadroAtual: str("NÃO REFERIDO"),
  atb: str("NÃO REFERIDO"),
  ultimoLab: str("Sem lab recente"),
  condutasHoje: str(""),
  alertasPendencias: str(""),
  dispositivos: nullableStr,
  anotacoesVisita: str(""),
});
export type PatientRow = z.infer<typeof PatientRowSchema>;

export const AlertaCriticoSchema = z.object({
  prioridade: z.preprocess(normalizePrioridade, PrioridadeEnum),
  leito: nullableStr,
  paciente: str("NÃO REFERIDO"),
  acao: z.string().trim().min(1),
});
export type AlertaCritico = z.infer<typeof AlertaCriticoSchema>;

export const PassagemPlantaoBatchSchema = z.object({
  pacientes: z.array(PatientRowSchema),
  alertasCriticos: z.array(AlertaCriticoSchema).catch([]),
});
export type PassagemPlantaoBatch = z.infer<typeof PassagemPlantaoBatchSchema>;
export type MapaPlantaoData = PassagemPlantaoBatch;

export const EvolutionReviewSchema = z.object({
  campos_faltantes: strArr,
  inconsistencias: strArr,
  alertas: strArr,
  sugestoes: strArr,
});
export type EvolutionReview = z.infer<typeof EvolutionReviewSchema>;

export const LabExtractionSchema = z.object({
  data_exame: nullableStr,
  tipo_exame: nullableStr,
  valores: z.record(z.union([z.string(), z.number(), z.null()])).transform((r) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v == null ? null : String(v)])),
  ).catch({}),
  texto_formatado: str(""),
  eas_formatado: nullableStr,
  alertas: strArr,
  valores_duvidosos: strArr,
  campos_nao_encontrados: strArr,
});
export type LabExtraction = z.infer<typeof LabExtractionSchema>;

export const HORARIOS = ["manha", "almoco", "tarde", "noite", "ao_deitar"] as const;
export const SugestaoReceitaSchema = z.object({
  itens: z
    .array(
      z.object({
        medicamentoId: nullableStr,
        nome: str(""),
        apresentacao: str(""),
        dose: str(""),
        quantidade: str(""),
        horarios: z
          .record(z.enum(HORARIOS), z.coerce.number().min(0).max(10))
          .catch({} as Partial<Record<(typeof HORARIOS)[number], number>>),
        instrucao: str(""),
        duracao: nullableStr,
        justificativa: str(""),
      }),
    )
    .catch([]),
  observacoes: strArr,
});
export type SugestaoReceita = z.infer<typeof SugestaoReceitaSchema>;
