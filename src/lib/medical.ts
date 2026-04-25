// Medical calculations and helpers (local only)

export type Sex = "M" | "F";

export function ckdEpi2021(creatinine: number, ageYears: number, sex: Sex): number {
  if (!creatinine || !ageYears) return 0;
  const k = sex === "F" ? 0.7 : 0.9;
  const alpha = sex === "F" ? -0.241 : -0.302;
  const sexFactor = sex === "F" ? 1.012 : 1.0;
  const scrK = creatinine / k;
  const min = Math.min(scrK, 1) ** alpha;
  const max = Math.max(scrK, 1) ** -1.2;
  const egfr = 142 * min * max * Math.pow(0.9938, ageYears) * sexFactor;
  return Math.round(egfr);
}

export function ckdStage(egfr: number): { stage: string; label: string; warn: boolean } {
  if (egfr <= 0) return { stage: "-", label: "NÃO CALCULADO", warn: false };
  if (egfr >= 90) return { stage: "G1", label: "NORMAL OU AUMENTADA", warn: false };
  if (egfr >= 60) return { stage: "G2", label: "LEVEMENTE DIMINUÍDA", warn: false };
  if (egfr >= 45) return { stage: "G3A", label: "LEVE A MODERADAMENTE DIMINUÍDA", warn: true };
  if (egfr >= 30) return { stage: "G3B", label: "MODERADA A GRAVEMENTE DIMINUÍDA", warn: true };
  if (egfr >= 15) return { stage: "G4", label: "GRAVEMENTE DIMINUÍDA", warn: true };
  return { stage: "G5", label: "FALÊNCIA RENAL", warn: true };
}

export function hgtStats(values: (number | undefined | null)[]) {
  const arr = values.filter((v): v is number => typeof v === "number" && !isNaN(v) && v > 0);
  if (!arr.length) return { mean: 0, peak: 0, nadir: 0, count: 0 };
  const sum = arr.reduce((a, b) => a + b, 0);
  return {
    mean: Math.round(sum / arr.length),
    peak: Math.max(...arr),
    nadir: Math.min(...arr),
    count: arr.length,
  };
}

/**
 * Calcula o dia do antibiótico
 * D0 = diff em dias
 * D1 = diff em dias + 1
 */
export function abxDay(d0Date: string, today: string, mode: "D0" | "D1" = "D1"): number {
  if (!d0Date) return 0;
  const a = new Date(d0Date + "T00:00:00");
  const b = new Date(today + "T00:00:00");
  const diff = Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  return mode === "D1" ? diff + 1 : diff;
}

export function getLabAlerts(vals: Record<string, string>, sex?: Sex, age?: number) {
  const alerts: string[] = [];
  const parse = (v: string) => parseFloat(v?.replace(",", ".") || "0");
  
  const hb = parse(vals["Hb"] || vals["Hemoglobina"]);
  const vcm = parse(vals["VCM"]);
  const cr = parse(vals["Creatinina"]);
  const pcr = parse(vals["PCR"]);

  if (hb > 0) {
    const hbLimit = sex === "F" ? 12 : 13;
    if (hb < 7) alerts.push("ANEMIA GRAVE");
    else if (hb < 10) alerts.push("ANEMIA MODERADA");
    else if (hb < hbLimit) alerts.push("ANEMIA LEVE");
  }

  if (vcm > 100) alerts.push("MACROCITOSE");
  else if (vcm > 0 && vcm < 80) alerts.push("MICROCITOSE");

  if (cr > 1.3) alerts.push("DISFUNÇÃO RENAL");
  if (pcr > 10) alerts.push("PROVA INFLAMATÓRIA ELEVADA");

  return alerts;
}

export function formatDateBR(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function pcrTrend(values: number[]): "rising" | "falling" | "stable" | "rebound" | null {
  if (values.length < 2) return null;
  let minIdx = 0;
  for (let i = 1; i < values.length; i++) if (values[i] < values[minIdx]) minIdx = i;
  if (minIdx < values.length - 1 && values[values.length - 1] > values[minIdx] * 1.5) return "rebound";
  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  if (last > prev * 1.1) return "rising";
  if (last < prev * 0.9) return "falling";
  return "stable";
}