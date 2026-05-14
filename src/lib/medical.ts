export type Sex = "M" | "F";

export { calcularDiaAtb, cicloAtbExcedido } from "./medical/antibiotico";
export { gerarAlertasPaciente } from "./medical/alertas";
export { gerarEvolucaoLocal } from "./medical/evolucaoLocal";
export { calcularHgtStats } from "./medical/glicemia";
export { detectarReascensaoPCR, formatarLaboratorio, gerarAnaliseLaboratorialLocal } from "./medical/laboratorio";
export { calcularCKDEPI2021, classificarDRC } from "./medical/renal";

import { calcularDiaAtb } from "./medical/antibiotico";
import { calcularHgtStats } from "./medical/glicemia";
import { detectarReascensaoPCR } from "./medical/laboratorio";
import { calcularCKDEPI2021, classificarDRC } from "./medical/renal";

export const ckdEpi2021 = calcularCKDEPI2021;
export const ckdStage = classificarDRC;
export const hgtStats = calcularHgtStats;
export const abxDay = calcularDiaAtb;

export function formatDateBR(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function pcrTrend(values: number[]): "rising" | "falling" | "stable" | "rebound" | null {
  if (values.length < 2) return null;
  if (detectarReascensaoPCR(values)) return "rebound";
  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  if (last > prev * 1.1) return "rising";
  if (last < prev * 0.9) return "falling";
  return "stable";
}

export function getLabAlerts(vals: Record<string, string>) {
  const alerts: string[] = [];
  const parse = (v?: string) => parseFloat(v?.replace(",", ".") || "0");
  const hb = parse(vals.Hb || vals.Hemoglobina || vals.hb);
  const cr = parse(vals.Creatinina || vals.Cr || vals.creatinina);
  const pcr = parse(vals.PCR || vals.pcr);
  if (hb > 0 && hb < 7) alerts.push("ANEMIA GRAVE");
  else if (hb > 0 && hb < 10) alerts.push("ANEMIA MODERADA");
  if (cr > 1.3) alerts.push("DISFUNÇÃO RENAL");
  if (pcr > 10) alerts.push("PROVA INFLAMATÓRIA ELEVADA");
  return alerts;
}
