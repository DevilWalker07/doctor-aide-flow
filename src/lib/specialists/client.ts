import { VITE_CLINICAL_AGENTS_URL } from "../clinicalAgentsConfig";
import type { ConsultRequestPayload, ConsultResponse, SavedConsult } from "./types";

const BACKEND_URL = VITE_CLINICAL_AGENTS_URL.replace(/\/$/, "");
const STORAGE_PREFIX = "da_specialist_consult_";

export async function consultSpecialist(payload: ConsultRequestPayload): Promise<ConsultResponse> {
  if (!BACKEND_URL) throw new Error("Backend de IA não configurado.");
  const response = await fetch(`${BACKEND_URL}/api/specialists/consult`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.detail || `Erro ao consultar especialista (${response.status}).`);
  }
  return response.json();
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
