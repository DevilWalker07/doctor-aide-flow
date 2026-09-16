import {
  classifyLab,
  LAB_THRESHOLDS,
  normalizeLabKey,
  type LabKey,
} from "../../../shared/medical/labThresholds";

export function detectarReascensaoPCR(values: number[]) {
  if (values.length < 3) return false;
  const previousMin = Math.min(...values.slice(0, -1));
  const last = values[values.length - 1];
  return last > previousMin * 1.5;
}

export function formatarLaboratorio(
  vals: Record<string, string | number | null | undefined>,
  date = new Date().toLocaleDateString("pt-BR"),
) {
  const get = (...keys: string[]) => {
    for (const key of keys) {
      const value = vals[key] ?? vals[key.toUpperCase()];
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return "NÃO REFERIDO";
  };

  return `LAB ATUAL (${date}): HB ${get("hb", "Hemoglobina")} / HT ${get("ht", "Hematócrito")} / LEUCO ${get("leukocytes", "leucocitos", "Leuco")} (${get("segmentedPercent", "segmentados_percent", "Segmentados")}% SEG / ${get("bandsPercent", "bastoes_percent", "Bastões")}% BAST) / PLQ ${get("platelets", "plaquetas", "Plq")} / CR ${get("creatinine", "creatinina", "Cr")} / UR ${get("urea", "Ureia")} / NA ${get("sodium", "sodio", "Na")} / K ${get("potassium", "potassio", "K")} / PCR ${get("crp", "pcr", "PCR")}`;
}

const ALIAS_EXTRA: Record<string, LabKey> = {
  creatinine: "CR",
  leukocytes: "LEUCO",
  platelets: "PLAQ",
  sodium: "NA",
  potassium: "K",
  crp: "PCR",
  urea: "UR",
  hemoglobina: "HB",
};

export function parseLabValues(
  vals: Record<string, string | number | null | undefined>,
): Partial<Record<LabKey, number>> {
  const out: Partial<Record<LabKey, number>> = {};
  for (const [rawKey, rawValue] of Object.entries(vals)) {
    if (rawValue == null || rawValue === "") continue;
    const key = ALIAS_EXTRA[rawKey.toLowerCase()] ?? normalizeLabKey(rawKey);
    if (!key || key in out) continue;
    const n = Number(
      String(rawValue)
        .replace(/\.(?=\d{3}\b)/g, "")
        .replace(",", "."),
    );
    if (Number.isFinite(n)) out[key] = n;
  }
  return out;
}

export interface AlertaLab {
  key: LabKey;
  severity: "critical" | "warning";
  message: string;
}

export function avaliarLaboratorio(
  vals: Record<string, string | number | null | undefined>,
): AlertaLab[] {
  const parsed = parseLabValues(vals);
  const alerts: AlertaLab[] = [];
  for (const key of Object.keys(parsed) as LabKey[]) {
    const value = parsed[key]!;
    const { severity, direction } = classifyLab(key, value);
    if (!severity) continue;
    const t = LAB_THRESHOLDS[key];
    alerts.push({
      key,
      severity,
      message: `${t.label.toUpperCase()} ${String(value).replace(".", ",")} ${direction === "low" ? "BAIXO" : "ALTO"}`,
    });
  }
  return alerts;
}

export function gerarAnaliseLaboratorialLocal(vals: Record<string, string>) {
  const alerts = avaliarLaboratorio(vals).map((a) => {
    if (a.key === "HB") return a.severity === "critical" ? "ANEMIA GRAVE" : "ANEMIA";
    if (a.key === "CR") return "DISFUNÇÃO RENAL";
    if (a.key === "PCR") return "PROVA INFLAMATÓRIA ELEVADA";
    return a.message;
  });
  return alerts.length
    ? [...new Set(alerts)].join(". ") + "."
    : "SEM ALERTAS LABORATORIAIS AUTOMÁTICOS.";
}
