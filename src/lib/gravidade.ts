/**
 * Heurísticas client-side para classificar gravidade de pacientes individualmente.
 * Usado no dashboard para triagem visual rápida quando o ranking do bulk
 * (passagem-massa) ainda não foi gerado para este paciente.
 *
 * Quando a passagem em massa rodar, ela sobrescreve o `gravidade` no paciente.
 */

export type Gravidade = "critico" | "grave" | "moderado" | "leve";

export interface GravidadeInput {
  // Aceita estruturas variadas vindas de pacientes locais e do Supabase.
  setor?: string | null;
  sector?: string | null;
  antibioticos?: Array<{ nome?: string; via?: string; data_inicio?: string; dataInicio?: string }>;
  antibiotics?: Array<{ nome?: string; via?: string; data_inicio?: string }>;
  pendencias?: Array<{ text?: string } | string>;
  pending_issues?: Array<string>;
  problemas_ativos?: string[];
  lista_de_problemas?: Array<string | { text?: string }>;
  motivo_admissao?: string | null;
  reason_for_admission?: string | null;
  status?: string | null;
  exame_fisico_detalhado?: Record<string, any> | null;
  physical_exam?: Record<string, any> | null;
  data_admissao?: string | null;
  admission_date?: string | null;
}

const CRITICAL_KEYWORDS = [
  "sepse", "choque", "septico", "intuba", "ventila", "vm", "pcr",
  "parada", "tvp", "tep", "iam", "avc", "hemorrag", "isquem",
  "drogas vasoativas", "dva", "noradr", "dobut",
];

const GRAVE_KEYWORDS = [
  "dispne", "sat baixa", "hipoxemia", "instavel", "rebaix", "delirium",
  "pneumonia grave", "icc descomp", "edema agudo",
];

function lc(s: any): string {
  return String(s || "").toLowerCase();
}

function pendingTexts(p: GravidadeInput): string[] {
  const out: string[] = [];
  for (const x of p.pendencias || []) {
    out.push(typeof x === "string" ? x : x?.text || "");
  }
  for (const x of p.pending_issues || []) out.push(x);
  return out.map(lc);
}

function problemTexts(p: GravidadeInput): string[] {
  const out: string[] = [];
  for (const x of p.problemas_ativos || []) out.push(x);
  for (const x of p.lista_de_problemas || []) {
    out.push(typeof x === "string" ? x : x?.text || "");
  }
  return out.map(lc);
}

function hasKeyword(haystacks: string[], needles: string[]): boolean {
  return haystacks.some((h) => needles.some((n) => h.includes(n)));
}

function isIV(atb: { via?: string }): boolean {
  const via = lc(atb.via);
  return via.includes("iv") || via.includes("endo");
}

function diasDeAtb(atb: { data_inicio?: string; dataInicio?: string }): number | null {
  const raw = atb.data_inicio || atb.dataInicio;
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  const ms = Date.now() - d.getTime();
  return Math.floor(ms / 86400000);
}

function atbAtivo(a: { status?: string; data_fim?: string; dataFim?: string; end_date?: string }): boolean {
  const status = (a.status || "").toLowerCase();
  if (status === "finalizado" || status === "suspenso") return false;
  const fim = a.data_fim || a.dataFim || a.end_date;
  if (fim) {
    const d = new Date(`${fim}T00:00:00`);
    if (!isNaN(d.getTime()) && d.getTime() <= Date.now()) return false;
  }
  return true;
}

export function computeGravidade(p: GravidadeInput): Gravidade {
  const setor = lc(p.setor || p.sector);
  const motivo = lc(p.motivo_admissao || p.reason_for_admission);
  const problems = problemTexts(p);
  const pendings = pendingTexts(p);
  const allTexts = [motivo, ...problems, ...pendings];

  const exam = p.exame_fisico_detalhado || p.physical_exam || {};
  const respText = lc(exam.modo || exam.ar || exam.geral);
  if (respText) allTexts.push(respText);

  // UTI por si só já sobe a barra
  const inUti = setor.includes("uti") || setor.includes("intensiv");

  if (hasKeyword(allTexts, CRITICAL_KEYWORDS) || respText.includes("psv") || respText.includes("vcv")) {
    return "critico";
  }

  const atbs = [...(p.antibioticos || []), ...(p.antibiotics || [])].filter(atbAtivo);
  const ivAtb = atbs.some(isIV);

  if (inUti) return "grave";
  if (ivAtb) return "grave";
  if (hasKeyword(allTexts, GRAVE_KEYWORDS)) return "grave";

  if (p.status === "alta_provavel") return "leve";
  if (atbs.length === 0 && pendings.length === 0) return "leve";

  return "moderado";
}

export const GRAVIDADE_STYLES: Record<Gravidade, { bg: string; text: string; ring: string; label: string; order: number }> = {
  critico: { bg: "bg-red-600", text: "text-white", ring: "border-l-red-600", label: "CRÍTICO", order: 0 },
  grave: { bg: "bg-orange-500", text: "text-white", ring: "border-l-orange-500", label: "GRAVE", order: 1 },
  moderado: { bg: "bg-amber-400", text: "text-amber-950", ring: "border-l-amber-400", label: "MODERADO", order: 2 },
  leve: { bg: "bg-emerald-500", text: "text-white", ring: "border-l-emerald-500", label: "LEVE", order: 3 },
};

export function gravidadeOrder(g: Gravidade): number {
  return GRAVIDADE_STYLES[g].order;
}

/** Retorna o maior número de dias de ATB ativo (D{N}) ou null se nenhum.
 * ATBs com status finalizado/suspenso ou data_fim no passado são ignorados. */
export function maxDiasAtb(
  atbs: Array<{ data_inicio?: string; dataInicio?: string; data_fim?: string; dataFim?: string; end_date?: string; status?: string }>,
): number | null {
  let max: number | null = null;
  for (const a of atbs || []) {
    if (!atbAtivo(a)) continue;
    const d = diasDeAtb(a);
    if (d != null && (max == null || d > max)) max = d;
  }
  return max;
}
