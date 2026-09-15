export type Sex = "M" | "F";

export { calcularDiaAtb, cicloAtbExcedido } from "./medical/antibiotico";
export { gerarAlertasPaciente } from "./medical/alertas";
export { gerarEvolucaoLocal } from "./medical/evolucaoLocal";
export { calcularHgtStats } from "./medical/glicemia";
export { avaliarLaboratorio, detectarReascensaoPCR, formatarLaboratorio, gerarAnaliseLaboratorialLocal, parseLabValues } from "./medical/laboratorio";
export { calcularCKDEPI2021, classificarDRC } from "./medical/renal";
export { LAB_THRESHOLDS } from "../../shared/medical/labThresholds";

import { calcularDiaAtb } from "./medical/antibiotico";
import { calcularHgtStats } from "./medical/glicemia";
import { avaliarLaboratorio, detectarReascensaoPCR } from "./medical/laboratorio";
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
  return [
    ...new Set(
      avaliarLaboratorio(vals).map((a) => {
        if (a.key === "HB") return a.severity === "critical" ? "ANEMIA GRAVE" : "ANEMIA MODERADA";
        if (a.key === "CR") return "DISFUNÇÃO RENAL";
        if (a.key === "PCR") return "PROVA INFLAMATÓRIA ELEVADA";
        return a.message;
      }),
    ),
  ];
}
