export type LabKey = "HB" | "HT" | "LEUCO" | "PLAQ" | "CR" | "UR" | "NA" | "K" | "GLI" | "LACTATO" | "PCR";

export interface Threshold {
  label: string;
  unit: string;
  aliases: string[];
  warnLow?: number;
  warnHigh?: number;
  critLow?: number;
  critHigh?: number;
}

export const LAB_THRESHOLDS: Record<LabKey, Threshold> = {
  HB: { label: "Hemoglobina", unit: "g/dL", aliases: ["HB", "HGB", "HEMOGLOBINA"], critLow: 7, warnLow: 10 },
  HT: { label: "Hematócrito", unit: "%", aliases: ["HT", "HCT", "HEMATOCRITO"], warnLow: 25 },
  LEUCO: { label: "Leucócitos", unit: "/mm³", aliases: ["LEUCO", "LEUCOCITOS", "LEUCOS", "WBC", "GB"], critLow: 1000, warnLow: 4000, warnHigh: 12000, critHigh: 30000 },
  PLAQ: { label: "Plaquetas", unit: "/mm³", aliases: ["PLAQ", "PLAQUETAS", "PLQ", "PLT"], critLow: 50000, warnLow: 100000 },
  CR: { label: "Creatinina", unit: "mg/dL", aliases: ["CR", "CREAT", "CREATININA"], warnHigh: 1.3, critHigh: 2.0 },
  UR: { label: "Ureia", unit: "mg/dL", aliases: ["UR", "UREIA"], warnHigh: 50, critHigh: 150 },
  NA: { label: "Sódio", unit: "mEq/L", aliases: ["NA", "SODIO"], critLow: 130, warnLow: 135, warnHigh: 145, critHigh: 155 },
  K: { label: "Potássio", unit: "mEq/L", aliases: ["K", "POTASSIO"], critLow: 3.0, warnLow: 3.5, warnHigh: 5.0, critHigh: 5.5 },
  GLI: { label: "Glicemia", unit: "mg/dL", aliases: ["GLI", "GLICEMIA", "GLICOSE", "HGT", "DX", "DEXTRO"], critLow: 60, warnLow: 70, warnHigh: 180, critHigh: 350 },
  LACTATO: { label: "Lactato", unit: "mmol/L", aliases: ["LACTATO", "LAC", "LACT"], critHigh: 2.0 },
  PCR: { label: "PCR", unit: "mg/L", aliases: ["PCR", "CRP"], warnHigh: 10, critHigh: 100 },
};

const ALIAS_INDEX: Record<string, LabKey> = Object.fromEntries(
  (Object.keys(LAB_THRESHOLDS) as LabKey[]).flatMap((key) => LAB_THRESHOLDS[key].aliases.map((a) => [a, key])),
) as Record<string, LabKey>;

export function normalizeLabKey(raw: string): LabKey | null {
  const k = raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return ALIAS_INDEX[k] ?? null;
}

export type LabSeverity = "critical" | "warning" | null;

export function classifyLab(key: LabKey, value: number): { severity: LabSeverity; direction: "low" | "high" | null } {
  const t = LAB_THRESHOLDS[key];
  if (t.critLow != null && value < t.critLow) return { severity: "critical", direction: "low" };
  if (t.critHigh != null && value > t.critHigh) return { severity: "critical", direction: "high" };
  if (t.warnLow != null && value < t.warnLow) return { severity: "warning", direction: "low" };
  if (t.warnHigh != null && value > t.warnHigh) return { severity: "warning", direction: "high" };
  return { severity: null, direction: null };
}

const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString("pt-BR") : n.toFixed(1).replace(".", ","));

export function renderThresholdsForPrompt(): string {
  const parts: string[] = [];
  for (const key of Object.keys(LAB_THRESHOLDS) as LabKey[]) {
    const t = LAB_THRESHOLDS[key];
    const conds: string[] = [];
    if (t.critLow != null) conds.push(`< ${fmt(t.critLow)}`);
    if (t.critHigh != null) conds.push(`> ${fmt(t.critHigh)}`);
    if (conds.length) parts.push(`${t.label} ${conds.join(" ou ")}`);
  }
  return parts.join(" · ");
}
