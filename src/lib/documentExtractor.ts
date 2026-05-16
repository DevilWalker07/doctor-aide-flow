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

import { storage } from "./storage";

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

  const response = await fetch(`${BACKEND_URL}/api/extract/extract-async`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || `Erro ao enviar arquivo (${response.status}).`);
  }

  const data = await response.json();
  if (!data.job_id) throw new Error("Backend não retornou job_id.");
  
  // Persist for page refresh / Safari
  storage.setJobAtivo(data.job_id);
  storage.setJobArquivo(file.name);
  
  return data.job_id as string;
}

/**
 * Gets the current status of a job. Single poll — no loop.
 */
export async function getClinicalExtractionJob(jobId: string): Promise<JobStatusResponse> {
  if (!BACKEND_URL) throw new Error("Backend de IA não configurado.");

  const response = await fetch(`${BACKEND_URL}/api/extract/job/${jobId}`);
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
          storage.clearJobAtivo();
          resolve(job.result);
          return;
        }

        if (job.status === "error") {
          storage.clearJobAtivo();
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

  const str = JSON.stringify(session);
  storage.setExtracaoResultado(str);
  localStorage.setItem("doutor_ajuda_extracao", str); // keep legacy for some components
  localStorage.setItem(EXTRACTION_SESSION_KEY, str);

  // Also write sessionStorage for tabs that might check it
  try {
    sessionStorage.setItem(EXTRACTION_SESSION_KEY, str);
    sessionStorage.setItem(EXTRACTION_RESULT_KEY, str);
  } catch {
    // sessionStorage might be restricted in some Safari modes
  }
}

/** Loads the most recent extraction session (used by /revisar-extracao) */
export function loadPendingExtraction(): ExtractionSession | null {
  try {
    const raw =
      sessionStorage.getItem(EXTRACTION_SESSION_KEY) ||
      storage.getExtracaoResultado() ||
      localStorage.getItem(EXTRACTION_SESSION_KEY);
    return raw ? (JSON.parse(raw) as ExtractionSession) : null;
  } catch {
    return null;
  }
}

// ─── Bulk extraction (passagem de plantão em lote) ────────────────────────────

export interface BulkProgress {
  done: number;
  error: number;
  processing: number;
  queued: number;
}

export interface BulkSubStatus {
  sub_job_id: string;
  file_name: string;
  status: "queued" | "processing" | "done" | "error";
  stage?: string;
}

export interface PassagemRankingItem {
  fileName: string;
  leito: string | null;
  nome: string | null;
  gravidade: "critico" | "grave" | "moderado" | "leve";
  dias_de_internacao: number | null;
  dias_de_antibiotico: number | null;
  resumo_uma_linha: string;
  criterios_gravidade_atendidos: string[];
  sugere_alta: boolean;
  por_que_alta: string | null;
  alertas_pendencias: string[];
}

export interface BulkJobStatus {
  status: "queued" | "processing" | "done" | "error";
  stage?: string;
  total: number;
  file_names: string[];
  sub_jobs: string[];
  patients: ClinicalExtractionResult[];
  passagem: {
    ranking?: PassagemRankingItem[];
    passagem_texto?: string;
    alertas_globais?: string[];
    contagem?: { critico: number; grave: number; moderado: number; leve: number };
    error?: string;
  } | null;
  errors: Array<{ sub_job_id: string; file_name: string; error: string }>;
  progress: BulkProgress;
  sub_status: BulkSubStatus[];
  extracted_count?: number;
  error_count?: number;
  error?: string;
  updated_at?: string;
  created_at?: string;
}

export async function startBulkExtractionJob(files: File[]): Promise<string> {
  if (!BACKEND_URL) throw new Error("Backend de IA não configurado.");
  if (files.length === 0) throw new Error("Nenhum arquivo selecionado.");
  if (files.length > 20) throw new Error("Máximo de 20 arquivos por lote.");

  const formData = new FormData();
  for (const f of files) formData.append("files", f);

  const response = await fetch(`${BACKEND_URL}/api/extract/bulk`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.detail || payload?.error || `Erro ao enviar lote (${response.status}).`);
  }
  const data = await response.json();
  if (!data.bulk_job_id) throw new Error("Backend não retornou bulk_job_id.");
  return data.bulk_job_id as string;
}

export async function getBulkExtractionJob(bulkJobId: string): Promise<BulkJobStatus> {
  if (!BACKEND_URL) throw new Error("Backend de IA não configurado.");
  const response = await fetch(`${BACKEND_URL}/api/extract/bulk/job/${bulkJobId}`);
  if (!response.ok) {
    if (response.status === 404) throw new Error("Lote não encontrado. O servidor pode ter reiniciado.");
    throw new Error(`Erro ao consultar lote (${response.status}).`);
  }
  return response.json();
}

/** Clears extraction session data */
export function clearExtractionSession() {
  storage.clearExtracaoResultado();
  storage.clearJobAtivo();
  localStorage.removeItem(EXTRACTION_SESSION_KEY);
  localStorage.removeItem("doutor_ajuda_extracao");
  try {
    sessionStorage.removeItem(EXTRACTION_RESULT_KEY);
    sessionStorage.removeItem(EXTRACTION_SESSION_KEY);
  } catch {
    // ignore
  }
}
