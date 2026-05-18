import { invokeEdgeFunction } from "../edgeFunctions";
import type { ConsultRequestPayload, ConsultResponse, SavedConsult } from "./types";

const STORAGE_PREFIX = "da_specialist_consult_";

export async function consultSpecialist(payload: ConsultRequestPayload): Promise<ConsultResponse> {
  return invokeEdgeFunction<ConsultResponse>("specialist-consult", payload, { timeoutMs: 180_000 });
}

/**
 * Persistência local dos pareceres por paciente.
 */
export function saveConsultForPatient(patientId: string, consult: ConsultResponse, acceptedIds: string[] = []): SavedConsult {
  const saved: SavedConsult = {
    ...consult,
    id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    patient_id: patientId,
    accepted_suggestion_ids: acceptedIds,
  };
  try {
    const key = STORAGE_PREFIX + patientId;
    const list: SavedConsult[] = JSON.parse(localStorage.getItem(key) || "[]");
    list.unshift(saved);
    localStorage.setItem(key, JSON.stringify(list.slice(0, 20)));
  } catch {
    /* ignore quota */
  }
  return saved;
}

export function listConsultsForPatient(patientId: string): SavedConsult[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_PREFIX + patientId) || "[]");
  } catch {
    return [];
  }
}

export function hasConsultForPatient(patientId: string): boolean {
  return listConsultsForPatient(patientId).length > 0;
}
