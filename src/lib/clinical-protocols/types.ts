/**
 * Sistema de Vigia Clínico — protocolos de detecção e prescrição.
 *
 * Cada protocolo é uma definição PURA (sem React, sem efeitos colaterais):
 *  - trigger(): regra determinística que olha o quadro do paciente e
 *    retorna se há match + evidência (ex.: "Na 120 mEq/L")
 *  - problem_entry(): texto exato pra adicionar na lista de problemas
 *  - protocol_text: texto detalhado do protocolo pra mostrar expandido
 *  - prescription(): builder que recebe o paciente e gera itens prontos
 *    pra inserir na tela de prescrição (com cálculo por peso/TFG)
 *  - warnings: limites de segurança (mostrados em destaque vermelho)
 *  - pendencias: reavaliações sugeridas (vão pro problem list)
 *
 * Vantagem: regras puras + testáveis + rápidas (<50ms pra rodar 20+
 * protocolos). Não dependem de IA — IA contextual é camada separada.
 */

export type Severity = "critico" | "grave" | "moderado" | "leve";

export type PrescriptionSection =
  | "dieta"
  | "cuidados"
  | "hidratacao"
  | "antibioticos"
  | "medicacoes"
  | "sintomaticos"
  | "profilaxias"
  | "exames"
  | "pendencias";

export interface PrescriptionItem {
  section: PrescriptionSection;
  text: string;
}

export interface PatientContext {
  peso?: number; // kg (se faltar usa 70 padrão adulto)
  sexo?: "M" | "F" | string;
  idade?: number; // anos
  tfg?: number; // Cockcroft-Gault calculado
  labs?: {
    sodio?: number;
    potassio?: number;
    creatinina?: number;
    ureia?: number;
    hb?: number;
    leucocitos?: number;
    plaquetas?: number;
    pcr?: number;
    lactato?: number;
    glicemia?: number;
  };
  problemas?: string[]; // lista atual de problemas (pra não duplicar)
  antibioticos?: Array<{ nome?: string; data_inicio?: string; status?: string }>;
}

export interface TriggerResult {
  matched: boolean;
  evidence?: string;
}

export interface ProtocolDefinition {
  id: string;
  title: string;
  severity: Severity;
  /** Detecção determinística — roda em <1ms */
  trigger: (ctx: PatientContext) => TriggerResult;
  /** Texto pra adicionar na lista de problemas do paciente */
  problem_entry: (ctx: PatientContext) => string;
  /** Resumo (1-2 linhas) */
  summary: string;
  /** Texto detalhado do protocolo */
  protocol_text: string;
  /** Itens de prescrição já calculados pelo peso/TFG do paciente */
  prescription: (ctx: PatientContext) => PrescriptionItem[];
  /** Alertas de segurança (limites, riscos) */
  warnings: string[];
  /** Reavaliações sugeridas */
  pendencias: string[];
}

export interface ClinicalFinding {
  id: string;
  protocol_id: string;
  severity: Severity;
  title: string;
  evidence: string;
  problem_entry: string;
  detected_at: string;
}

export const SEVERITY_STYLES: Record<Severity, { bg: string; text: string; border: string; label: string; order: number }> = {
  critico: { bg: "bg-red-500/10 dark:bg-red-500/20", text: "text-red-700 dark:text-red-300", border: "border-red-500/40", label: "CRÍTICO", order: 0 },
  grave: { bg: "bg-orange-500/10 dark:bg-orange-500/20", text: "text-orange-700 dark:text-orange-300", border: "border-orange-500/40", label: "GRAVE", order: 1 },
  moderado: { bg: "bg-amber-500/10 dark:bg-amber-500/20", text: "text-amber-700 dark:text-amber-300", border: "border-amber-500/40", label: "MODERADO", order: 2 },
  leve: { bg: "bg-blue-500/10 dark:bg-blue-500/20", text: "text-blue-700 dark:text-blue-300", border: "border-blue-500/40", label: "LEVE", order: 3 },
};
