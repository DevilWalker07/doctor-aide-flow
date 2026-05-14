import type { Patient } from "../types/patient";
import { calcularDiaAtb } from "./antibiotico";
import { detectarReascensaoPCR } from "./laboratorio";

export function gerarAlertasPaciente(patient: Pick<Patient, "data" | "alerts">) {
  const alerts = new Set(patient.alerts || []);
  const today = new Date().toISOString().slice(0, 10);

  patient.data?.abx?.forEach((atb) => {
    const dia = calcularDiaAtb(atb.d0, today);
    if (dia > atb.durDays) alerts.add("REVISAR CICLO DE ANTIBIÓTICO");
  });

  if (patient.data?.pcrHist && detectarReascensaoPCR(patient.data.pcrHist)) {
    alerts.add("PCR REASCENDENTE");
  }

  return Array.from(alerts);
}
