import { z } from "zod";

/**
 * Schemas dos agentes internos (`agents/`).
 *
 * Regra da casa vale aqui também: nenhuma saída de IA vira arquivo ou commit
 * sem passar por schema. Fica mais barato descartar uma resposta malformada
 * do que descobrir depois que o "id" do item era `undefined`.
 */

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .transform((s) => s.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""))
  .pipe(z.string().min(3));

// ─── Agente analista (auditoria do produto) ─────────────────────────────────

export const CategoriaAnalise = z.enum([
  "produto",
  "seguranca",
  "confiabilidade",
  "performance",
  "ux",
  "dx",
  "dados",
]);
export type CategoriaAnalise = z.infer<typeof CategoriaAnalise>;

export const PrioridadeSchema = z.enum(["alta", "media", "baixa"]).catch("media");
export const EsforcoSchema = z.enum(["pequeno", "medio", "grande"]).catch("medio");

export const AnaliseItemSchema = z.object({
  id: slug,
  titulo: z.string().min(4).max(120),
  categoria: CategoriaAnalise.catch("produto"),
  prioridade: PrioridadeSchema,
  esforco: EsforcoSchema,
  problema: z.string().min(10),
  sugestao: z.string().min(10),
  arquivos_relacionados: z.array(z.string()).catch([]),
});
export type AnaliseItem = z.infer<typeof AnaliseItemSchema>;

export const AnaliseOutputSchema = z.object({
  resumo: z.string().min(10),
  itens: z.array(AnaliseItemSchema).min(1).max(30),
});
export type AnaliseOutput = z.infer<typeof AnaliseOutputSchema>;

/** Status do ciclo de vida de um item dentro do relatório persistido. */
export const StatusItemSchema = z.enum(["pendente", "em_andamento", "implementado", "falhou"]);
export type StatusItem = z.infer<typeof StatusItemSchema>;

/**
 * Item de análise + o que o agente implementador foi fazendo com ele.
 * Os campos de execução nunca vêm do modelo — só o script escreve neles.
 */
export const RegistroItemSchema = AnaliseItemSchema.extend({
  status: StatusItemSchema.default("pendente"),
  branch: z.string().nullable().default(null),
  commit: z.string().nullable().default(null),
  pr_url: z.string().nullable().default(null),
  erro: z.string().nullable().default(null),
  atualizado_em: z.string().default(() => new Date().toISOString()),
});
export type RegistroItem = z.infer<typeof RegistroItemSchema>;

export const RegistroSchema = z.object({
  resumo: z.string(),
  gerado_em: z.string(),
  itens: z.array(RegistroItemSchema),
});
export type Registro = z.infer<typeof RegistroSchema>;

// ─── Agente consultor médico (uso interno do engenheiro) ────────────────────

export const AreaConsultorMedico = z.enum([
  "fluxo-clinico",
  "seguranca-paciente",
  "comunicacao-equipe",
  "documentacao",
  "tempo-a-beira-leito",
  "outro",
]);

export const ConsultorItemSchema = z.object({
  titulo: z.string().min(4).max(120),
  area: AreaConsultorMedico.catch("outro"),
  prioridade: PrioridadeSchema,
  problema_clinico: z.string().min(10),
  sugestao_para_engenharia: z.string().min(10),
});
export type ConsultorItem = z.infer<typeof ConsultorItemSchema>;

export const ConsultorOutputSchema = z.object({
  resumo: z.string().min(10),
  itens: z.array(ConsultorItemSchema).min(1).max(20),
});
export type ConsultorOutput = z.infer<typeof ConsultorOutputSchema>;
