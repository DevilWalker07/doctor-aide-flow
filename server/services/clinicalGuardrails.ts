import { classifyLab, LAB_THRESHOLDS, normalizeLabKey, type LabKey } from "../../shared/medical/labThresholds.js";

export type GuardrailSeverity = "critical" | "warning";

export interface GuardrailFinding {
  severity: GuardrailSeverity;
  field: string;
  message: string;
  value?: number | string;
}

export interface Vitals {
  pas?: number;
  pad?: number;
  fc?: number;
  fr?: number;
  spo2?: number;
  temp?: number;
  glicemia?: number;
}

const VITAL_RANGES: Record<keyof Vitals, [number, number, string]> = {
  pas: [40, 300, "PAS"],
  pad: [20, 200, "PAD"],
  fc: [20, 300, "FC"],
  fr: [4, 80, "FR"],
  spo2: [50, 100, "SpO2"],
  temp: [30, 45, "Temperatura"],
  glicemia: [10, 1000, "Glicemia"],
};

export function validateVitals(v: Vitals, fieldPrefix = "vitals"): GuardrailFinding[] {
  const findings: GuardrailFinding[] = [];
  for (const key of Object.keys(VITAL_RANGES) as (keyof Vitals)[]) {
    const value = v[key];
    if (value == null || Number.isNaN(value)) continue;
    const [min, max, label] = VITAL_RANGES[key];
    if (value < min || value > max) {
      findings.push({ severity: "critical", field: `${fieldPrefix}.${key}`, message: `${label} ${value} fisiologicamente implausível (esperado ${min}–${max})`, value });
    }
  }
  if (v.pas != null && v.pad != null && v.pad >= v.pas) {
    findings.push({ severity: "critical", field: `${fieldPrefix}.pa`, message: `PA ${v.pas}x${v.pad}: diastólica ≥ sistólica (valor implausível)`, value: `${v.pas}x${v.pad}` });
  }
  return findings;
}

function parseNumber(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ""));
  const n = Number(s.replace(/\./g, (m, offset, str) => (str.indexOf(",") === -1 && /^\d{1,3}\.\d{3}$/.test(str) ? "" : m)).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const LAB_TOKEN_RE = /([A-Za-zÀ-ú]{1,14})\s*[:=]?\s*(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)/g;

export function parseLabString(s: string): Partial<Record<LabKey, number>> {
  const out: Partial<Record<LabKey, number>> = {};
  if (!s) return out;
  for (const m of s.matchAll(LAB_TOKEN_RE)) {
    const key = normalizeLabKey(m[1]);
    if (!key || key in out) continue;
    const value = parseNumber(m[2]);
    if (value != null) out[key] = value;
  }
  return out;
}

export function parseVitalsFromText(s: string): Vitals {
  const v: Vitals = {};
  if (!s) return v;
  const pa = s.match(/\bPA\s*[:=]?\s*(\d{2,3})\s*[x×\/]\s*(\d{2,3})/i);
  if (pa) {
    v.pas = Number(pa[1]);
    v.pad = Number(pa[2]);
  }
  const fc = s.match(/\bFC\s*[:=]?\s*(\d{2,3})/i);
  if (fc) v.fc = Number(fc[1]);
  const fr = s.match(/\bFR\s*[:=]?\s*(\d{1,2})/i);
  if (fr) v.fr = Number(fr[1]);
  const sat = s.match(/\b(?:SAT|SPO2|SATO2)\s*[:=]?\s*(\d{2,3})\s*%?/i);
  if (sat) v.spo2 = Number(sat[1]);
  const temp = s.match(/\b(?:TAX|TEMP|T)\s*[:=]?\s*(\d{2}(?:[.,]\d)?)\s*(?:°|º|C\b)?/i);
  if (temp) v.temp = Number(temp[1].replace(",", "."));
  const gli = s.match(/\b(?:HGT|GLICEMIA|DX|DEXTRO)\s*[:=]?\s*(\d{2,4})/i);
  if (gli) v.glicemia = Number(gli[1]);
  return v;
}

export function flagLabOutliers(labs: Partial<Record<LabKey, number>> | string, fieldPrefix = "lab"): GuardrailFinding[] {
  const values = typeof labs === "string" ? parseLabString(labs) : labs;
  const findings: GuardrailFinding[] = [];
  for (const key of Object.keys(values) as LabKey[]) {
    const value = values[key];
    if (value == null) continue;
    const { severity, direction } = classifyLab(key, value);
    if (!severity) continue;
    const t = LAB_THRESHOLDS[key];
    const limit = direction === "low" ? (severity === "critical" ? t.critLow : t.warnLow) : severity === "critical" ? t.critHigh : t.warnHigh;
    findings.push({
      severity,
      field: `${fieldPrefix}.${key}`,
      message: `${t.label} ${String(value).replace(".", ",")} ${direction === "low" ? "<" : ">"} ${String(limit).replace(".", ",")} ${t.unit}`.trim(),
      value,
    });
  }
  return findings;
}

export interface AtbInput {
  nome: string;
  doseValor?: number;
  doseUnidade?: "g" | "mg";
  via?: "EV" | "VO" | "IM" | "SC";
  frequencia?: string;
  dia?: number;
  duracao?: number;
  raw: string;
}

const VIA_RE = /\b(EV|IV|VO|IM|SC)\b/i;

export function parseAtbString(s: string): AtbInput[] {
  if (!s) return [];
  return s
    .split(/\n|;|\s\+\s/)
    .map((part) => part.trim())
    .filter((part) => part && !/^sem atb$/i.test(part) && !/^n[aã]o referido$/i.test(part))
    .map((raw) => {
      const atb: AtbInput = { nome: raw, raw };
      const nome = raw.match(/^([A-Za-zÀ-ú][A-Za-zÀ-ú\-\s]*?)(?=\s+\d|\s+\(|\s+[—–-]\s|\s+D\d|\s+D\?|$)/);
      if (nome) atb.nome = nome[1].trim();
      const dose = raw.match(/(\d+(?:[.,]\d+)?)\s*(g|mg)\b/i);
      if (dose) {
        atb.doseValor = Number(dose[1].replace(",", "."));
        atb.doseUnidade = dose[2].toLowerCase() as "g" | "mg";
      }
      const via = raw.match(VIA_RE);
      if (via) atb.via = (via[1].toUpperCase() === "IV" ? "EV" : via[1].toUpperCase()) as AtbInput["via"];
      const freq = raw.match(/(\d{1,2}\s*\/\s*\d{1,2}\s*h|\d+x\/dia|1x\/dia|dose única)/i);
      if (freq) atb.frequencia = freq[1].replace(/\s+/g, "");
      const dia = raw.match(/\bD\s*(\d{1,2})(?:\s*\/\s*(\d{1,2}))?/i);
      if (dia) {
        atb.dia = Number(dia[1]);
        if (dia[2]) atb.duracao = Number(dia[2]);
      }
      return atb;
    });
}

const MAX_DOSE_G: Record<NonNullable<AtbInput["via"]>, number> = { EV: 6, VO: 4, IM: 2, SC: 1 };

export function checkDoseAnomalies(atb: AtbInput[] | string, fieldPrefix = "atb"): GuardrailFinding[] {
  const list = typeof atb === "string" ? parseAtbString(atb) : atb;
  const findings: GuardrailFinding[] = [];
  list.forEach((a, i) => {
    const field = `${fieldPrefix}[${i}]`;
    if (a.doseValor != null && a.doseUnidade) {
      const grams = a.doseUnidade === "g" ? a.doseValor : a.doseValor / 1000;
      const limit = MAX_DOSE_G[a.via ?? "EV"];
      if (grams > limit) findings.push({ severity: "warning", field, message: `${a.nome}: dose ${a.doseValor}${a.doseUnidade} por tomada acima do usual para via ${a.via ?? "EV"} (> ${limit} g) — conferir`, value: a.raw });
    }
    if (a.dia != null && a.duracao != null && a.dia > a.duracao) {
      findings.push({ severity: "warning", field, message: `${a.nome}: D${a.dia} ultrapassa a duração planejada de ${a.duracao} dias — revisar suspensão`, value: a.raw });
    }
    if (a.duracao != null && a.duracao > 21) {
      findings.push({ severity: "warning", field, message: `${a.nome}: duração planejada de ${a.duracao} dias (> 21) — confirmar indicação`, value: a.raw });
    }
    if (a.dia != null && a.dia >= 7 && a.duracao == null) {
      findings.push({ severity: "warning", field, message: `${a.nome}: D${a.dia} sem duração planejada registrada — definir tempo de tratamento`, value: a.raw });
    }
  });
  return findings;
}

export function cockcroftGault(idadeAnos: number, pesoKg: number, creatinina: number, sexo: "M" | "F"): number {
  if (!(idadeAnos > 0) || !(pesoKg > 0) || !(creatinina > 0)) return NaN;
  const base = ((140 - idadeAnos) * pesoKg) / (72 * creatinina);
  return Math.round(base * (sexo === "F" ? 0.85 : 1) * 10) / 10;
}

export interface PatientGuardrailInput {
  laboratorio?: string | null;
  labs?: Partial<Record<LabKey, number>>;
  antibioticos?: string | AtbInput[] | null;
  quadro?: string | null;
  vitals?: Vitals;
  idade?: number | null;
  peso?: number | null;
  sexo?: "M" | "F" | "" | null;
}

export function runPatientGuardrails(input: PatientGuardrailInput): GuardrailFinding[] {
  const findings: GuardrailFinding[] = [];
  const labs = input.labs ?? (input.laboratorio ? parseLabString(input.laboratorio) : {});
  findings.push(...flagLabOutliers(labs));
  if (input.antibioticos) findings.push(...checkDoseAnomalies(input.antibioticos));
  const vitals = input.vitals ?? (input.quadro ? parseVitalsFromText(input.quadro) : {});
  findings.push(...validateVitals(vitals));

  if (labs.CR != null && input.idade && input.peso && (input.sexo === "M" || input.sexo === "F")) {
    const clcr = cockcroftGault(input.idade, input.peso, labs.CR, input.sexo);
    if (clcr < 30) findings.push({ severity: "critical", field: "renal.clcr", message: `ClCr estimado ${clcr} mL/min (Cockcroft-Gault) — ajuste renal obrigatório`, value: clcr });
    else if (clcr < 60) findings.push({ severity: "warning", field: "renal.clcr", message: `ClCr estimado ${clcr} mL/min — verificar doses de eliminação renal`, value: clcr });
  }
  return findings;
}

export function findingsToAlerts(findings: GuardrailFinding[], onlyCritical = false): string[] {
  return findings
    .filter((f) => !onlyCritical || f.severity === "critical")
    .map((f) => `${f.severity === "critical" ? "[CRÍTICO]" : "[ATENÇÃO]"} ${f.message}`.toUpperCase());
}

export function mergeAlerts(existing: string[], incoming: string[]): string[] {
  const seen = new Set(existing.map((a) => a.trim().toUpperCase()));
  const out = [...existing];
  for (const a of incoming) {
    const k = a.trim().toUpperCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(a);
    }
  }
  return out;
}
