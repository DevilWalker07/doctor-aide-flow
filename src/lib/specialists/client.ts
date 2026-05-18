import { supabase } from "../supabase";
import type { ConsultRequestPayload, ConsultResponse, SavedConsult } from "./types";

const STORAGE_PREFIX = "da_specialist_consult_";

export async function consultSpecialist(payload: ConsultRequestPayload): Promise<ConsultResponse> {
  const { data, error } = await supabase.functions.invoke("specialist-consult", {
    body: payload,
  });
  if (error) {
    throw new Error(error.message || "Erro ao consultar especialista.");
  }
  if (!data || typeof data !== "object") {
    throw new Error("Resposta inválida do especialista.");
  }
  if ((data as any).error) {
    throw new Error((data as any).error);
  }
  return data as ConsultResponse;
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
