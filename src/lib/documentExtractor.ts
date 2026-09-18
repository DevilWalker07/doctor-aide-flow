/**
 * documentExtractor.ts
 * Cliente frontend para o fluxo de extração assíncrona de documentos.
 * Gerencia upload → polling → resultado.
 */

import { apiFetch } from "./apiClient";
import { supabase } from "./supabase";
import { mimeDoArquivo } from "./mimeDocumento";

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

async function lerErro(response: Response, padrao: string): Promise<never> {
  const payload = await response.json().catch(() => ({}) as Record<string, unknown>);
  throw new Error(String(payload?.message || payload?.error || padrao));
}

/**
 * Envia o arquivo e devolve um job_id na hora. Nunca espera pela IA.
 *
 * O arquivo **não passa pelo servidor**: vai direto para o Supabase Storage,
 * num caminho dentro da pasta do próprio médico, e o backend recebe só esse
 * caminho. Antes era multipart de até 20 MB pela API — o que não cabe no limite
 * de corpo de uma função serverless, e fazia o documento trafegar duas vezes.
 *
 * `onProgresso` existe porque o envio agora é a parte lenta e visível: sem
 * retorno na tela, quem está de pé no corredor acha que o app travou.
 */
export async function startClinicalExtractionJob(
  file: File,
  onProgresso?: (etapa: "enviando" | "lendo") => void,
): Promise<string> {
  onProgresso?.("enviando");

  const prep = await apiFetch("/api/extract/preparar-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_name: file.name }),
  });
  if (!prep.ok) await lerErro(prep, `Não foi possível preparar o envio (${prep.status}).`);
  const plano = (await prep.json()) as {
    modo: "storage" | "multipart";
    bucket?: string;
    storage_path?: string;
    token?: string;
  };

  let response: Response;

  if (plano.modo === "storage" && plano.bucket && plano.storage_path) {
    // Autorização emitida pelo servidor: sem login não há sessão aqui, e o RLS
    // do bucket barraria o envio direto.
    const { error: erroUpload } = await supabase.storage
      .from(plano.bucket)
      .uploadToSignedUrl(plano.storage_path, plano.token ?? "", file, {
        contentType: mimeDoArquivo(file),
      });
    if (erroUpload) throw new Error(`Falha ao enviar o arquivo: ${erroUpload.message}`);

    onProgresso?.("lendo");
    response = await apiFetch("/api/extract/extract-async", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storage_path: plano.storage_path, file_name: file.name }),
    });
  } else {
    // Modo local: sem Supabase configurado, o arquivo vai pelo próprio
    // servidor. É o que faz `npm run dev:all` funcionar sem nenhum serviço.
    onProgresso?.("lendo");
    const formData = new FormData();
    formData.append("file", file);
    response = await apiFetch("/api/extract/extract-async", {
      method: "POST",
      body: formData,
    });
  }

  if (!response.ok) await lerErro(response, `Erro ao iniciar a leitura (${response.status}).`);

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
  const response = await apiFetch(`/api/extract/job/${encodeURIComponent(jobId)}`);
  if (!response.ok) {
    if (response.status === 404)
      throw new Error("Job não encontrado. O servidor pode ter reiniciado.");
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
  pollIntervalMs = 3_000,
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
