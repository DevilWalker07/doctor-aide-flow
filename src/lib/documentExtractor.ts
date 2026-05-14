/**
 * documentExtractor.ts
 * Cliente frontend para o fluxo de extração assíncrona de documentos.
 * Gerencia upload → polling → resultado.
 */

import { VITE_CLINICAL_AGENTS_URL } from "./clinicalAgentsConfig";

const BACKEND_URL = VITE_CLINICAL_AGENTS_URL.replace(/\/$/, "");

export interface JobStatusResponse {
  job_id: string;
  status: "queued" | "processing" | "done" | "error";
  stage: string;
  result?: ClinicalExtractionResult;
  error?: string | null;
}

export interface ClinicalExtractionResult {
  // Simple schema
  nome: string | null;
  idade: number | null;
  sexo: string | null;
  leito: string | null;
  setor: string | null;
  data_admissao: string | null;
  hda: string | null;
  lista_de_problemas: string[];
  antibioticos: string[];
  medicacoes: string[];
  laboratorios: string[];
  exame_fisico: string | null;
  condutas: string[];
  pendencias: string[];
  alertas: string[];
  // Legacy schema
  patient_identification?: Record<string, unknown>;
  clinical_data?: Record<string, unknown>;
  suggested_patient?: Record<string, unknown>;
  safety_alerts?: string[];
  uncertain_fields?: string[];
  raw_summary?: string;
  // Metadata
  engine?: string;
  fileName?: string;
  markdown?: string;
}

/** Format expected by /revisar-extracao (loadPendingExtraction) */
export interface ExtractionSession {
  fileName: string;
  engine: string;
  markdown: string;
  extracted: ClinicalExtractionResult;
  createdAt: string;
}

const EXTRACTION_RESULT_KEY = "extracao_resultado";
const EXTRACTION_SESSION_KEY = "extracao_session";

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * Sends the file to the backend and returns a job_id immediately.
 * Never waits for AI processing.
 */
export async function startClinicalExtractionJob(file: File): Promise<string> {
  if (!BACKEND_URL) throw new Error("Backend de IA não configurado (VITE_CLINICAL_AGENTS_URL).");

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${BACKEND_URL}/extract-async`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || `Erro ao enviar arquivo (${response.status}).`);
  }

  const data = await response.json();
  if (!data.job_id) throw new Error("Backend não retornou job_id.");
  return data.job_id as string;
}

/**
 * Gets the current status of a job. Single poll — no loop.
 */
export async function getClinicalExtractionJob(jobId: string): Promise<JobStatusResponse> {
  if (!BACKEND_URL) throw new Error("Backend de IA não configurado.");

  const response = await fetch(`${BACKEND_URL}/job/${jobId}`);
  if (!response.ok) {
    if (response.status === 404) throw new Error("Job não encontrado. O servidor pode ter reiniciado.");
    throw new Error(`Erro ao consultar job (${response.status}).`);
  }
  return response.json();
}

/**
 * Full async extraction with polling — for direct programmatic use.
 * Resolves when done, rejects on error or timeout.
 */
export async function extractClinicalDocument(
  file: File,
  onProgress?: (stage: string, status: string) => void,
  timeoutMs = 180_000,
  pollIntervalMs = 3_000
): Promise<ClinicalExtractionResult> {
  const jobId = await startClinicalExtractionJob(file);

  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;

    const poll = async () => {
      if (Date.now() > deadline) {
        reject(new Error("Tempo limite de 3 minutos atingido. Tente novamente."));
        return;
      }

      try {
        const job = await getClinicalExtractionJob(jobId);
        onProgress?.(job.stage, job.status);

        if (job.status === "done" && job.result) {
          resolve(job.result);
          return;
        }

        if (job.status === "error") {
          reject(new Error(job.error || "Erro desconhecido no processamento."));
          return;
        }

        setTimeout(poll, pollIntervalMs);
      } catch (err) {
        reject(err);
      }
    };

    setTimeout(poll, pollIntervalMs);
  });
}

// ─── Session persistence ──────────────────────────────────────────────────────

/** Saves extraction result to localStorage in both formats */
export function saveExtractionResult(result: ClinicalExtractionResult, fileName: string) {
  const session = {
    fileName: result.fileName || fileName || "documento",
    engine: result.engine || "openai-vision",
    markdown: result.markdown || result.hda || "",
    extracted: result,
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem(EXTRACTION_RESULT_KEY, JSON.stringify(session));
  localStorage.setItem(EXTRACTION_SESSION_KEY, JSON.stringify(session));

  // Also write sessionStorage for tabs that might check it
  try {
    sessionStorage.setItem(EXTRACTION_SESSION_KEY, JSON.stringify(session));
    sessionStorage.setItem(EXTRACTION_RESULT_KEY, JSON.stringify(session));
  } catch {
    // sessionStorage might be restricted in some Safari modes
  }
}

/** Loads the most recent extraction session (used by /revisar-extracao) */
export function loadPendingExtraction(): ExtractionSession | null {
  try {
    const raw =
      sessionStorage.getItem(EXTRACTION_SESSION_KEY) ||
      localStorage.getItem(EXTRACTION_SESSION_KEY);
    return raw ? (JSON.parse(raw) as ExtractionSession) : null;
  } catch {
    return null;
  }
}

/** Clears extraction session data */
export function clearExtractionSession() {
  localStorage.removeItem(EXTRACTION_RESULT_KEY);
  localStorage.removeItem(EXTRACTION_SESSION_KEY);
  try {
    sessionStorage.removeItem(EXTRACTION_RESULT_KEY);
    sessionStorage.removeItem(EXTRACTION_SESSION_KEY);
  } catch {
    // ignore
  }
}
