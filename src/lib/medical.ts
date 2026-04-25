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
  if (egfr >= 90) return { stage: "G1", label: "NORMAL OU AUMENTADA", warn: false };
  if (egfr >= 60) return { stage: "G2", label: "LEVEMENTE DIMINUÍDA", warn: false };
  if (egfr >= 45) return { stage: "G3A", label: "LEVE A MODERADAMENTE DIMINUÍDA", warn: true };
  if (egfr >= 30) return { stage: "G3B", label: "MODERADA A GRAVEMENTE DIMINUÍDA", warn: true };
  if (egfr >= 15) return { stage: "G4", label: "GRAVEMENTE DIMINUÍDA", warn: true };
  return { stage: "G5", label: "FALÊNCIA RENAL", warn: true };
}

export function hgtStats(values: (number | undefined | null)[]) {
  const arr = values.filter((v): v is number => typeof v === "number" && !isNaN(v));
  if (!arr.length) return { mean: 0, peak: 0, nadir: 0, count: 0 };
  const sum = arr.reduce((a, b) => a + b, 0);
  return {
    mean: Math.round(sum / arr.length),
    peak: Math.max(...arr),
    nadir: Math.min(...arr),
    count: arr.length,
  };
}

export function abxDay(d0: string, today: string): number {
  // D0 starts at 1
  const a = new Date(d0 + "T00:00:00");
  const b = new Date(today + "T00:00:00");
  const diff = Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
  return diff + 1;
}

export function formatDateBR(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function pcrTrend(values: number[]): "rising" | "falling" | "stable" | "rebound" | null {
  if (values.length < 2) return null;
  // rebound: had a low, then climbs again
  let minIdx = 0;
  for (let i = 1; i < values.length; i++) if (values[i] < values[minIdx]) minIdx = i;
  if (minIdx < values.length - 1 && values[values.length - 1] > values[minIdx] * 2) return "rebound";
  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  if (last > prev * 1.2) return "rising";
  if (last < prev * 0.8) return "falling";
  return "stable";
}