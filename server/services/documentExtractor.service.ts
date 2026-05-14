import fs from "fs";
import path from "path";
import os from "os";
import { getOpenAIClient, DEFAULT_MODEL } from "./openaiClient.js";
import { DOCUMENT_EXTRACTION_PROMPT } from "../prompts/documentExtraction.prompt.js";

// ─── Job State Store ─────────────────────────────────────────────────────────

export type JobStatus = "queued" | "processing" | "done" | "error";

export interface JobState {
  job_id: string;
  status: JobStatus;
  stage: string;
  result?: ClinicalExtractionResult;
  error?: string | null;
  createdAt: string;
}

export interface ClinicalExtractionResult {
  // New simple schema
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
  // Legacy compatibility schema
  patient_identification: Record<string, unknown>;
  clinical_data: Record<string, unknown>;
  suggested_patient: Record<string, unknown>;
  safety_alerts: string[];
  uncertain_fields: string[];
  raw_summary: string;
  // Engine metadata
  engine: string;
  fileName?: string;
  markdown?: string;
}

export const JOBS = new Map<string, JobState>();

// Clean up old jobs (older than 1 hour) periodically
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of JOBS.entries()) {
    if (new Date(job.createdAt).getTime() < cutoff) {
      JOBS.delete(id);
    }
  }
}, 10 * 60 * 1000);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function updateJob(jobId: string, patch: Partial<JobState>) {
  const job = JOBS.get(jobId);
  if (job) JOBS.set(jobId, { ...job, ...patch });
}

function normalizeToLegacySchema(simple: Partial<ClinicalExtractionResult>): ClinicalExtractionResult {
  const nome = simple.nome || null;
  const idade = simple.idade || null;
  const sexo = simple.sexo || null;
  const leito = simple.leito || null;
  const setor = simple.setor || null;
  const hda = simple.hda || null;

  return {
    nome,
    idade,
    sexo,
    leito,
    setor,
    data_admissao: simple.data_admissao || null,
    hda,
    lista_de_problemas: simple.lista_de_problemas || [],
    antibioticos: simple.antibioticos || [],
    medicacoes: simple.medicacoes || [],
    laboratorios: simple.laboratorios || [],
    exame_fisico: simple.exame_fisico || null,
    condutas: simple.condutas || [],
    pendencias: simple.pendencias || [],
    alertas: simple.alertas || [],
    // Legacy compatibility
    patient_identification: {
      nome,
      idade,
      sexo,
      leito,
      setor,
    },
    clinical_data: {
      hda,
      lista_de_problemas: simple.lista_de_problemas || [],
      antibioticos: simple.antibioticos || [],
      medicacoes: simple.medicacoes || [],
      laboratorios: simple.laboratorios || [],
      exame_fisico: simple.exame_fisico || null,
      condutas: simple.condutas || [],
      pendencias: simple.pendencias || [],
    },
    suggested_patient: {
      bed: leito || "",
      name: nome || "PACIENTE SEM NOME",
      age: idade || 0,
      sex: sexo === "M" ? "M" : "F",
      sector: setor || "CLÍNICA MÉDICA",
      hda: hda || "",
      diagnoses: simple.lista_de_problemas || [],
      alerts: simple.alertas || [],
    },
    safety_alerts: simple.alertas || [],
    uncertain_fields: [],
    raw_summary: hda || "",
    engine: simple.engine || "openai-direct",
    fileName: simple.fileName,
    markdown: simple.markdown,
  };
}

async function callOpenAIVision(imageBase64: string, mimeType: string, fileName: string): Promise<ClinicalExtractionResult> {
  const client = getOpenAIClient();
  if (!client) throw new Error("OPENAI_API_KEY não configurada no servidor.");

  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: DOCUMENT_EXTRACTION_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "high" },
          },
          {
            type: "text",
            text: "Extraia os dados clínicos desta imagem médica conforme o schema solicitado.",
          },
        ],
      },
    ],
  });

  const raw = JSON.parse(response.choices[0]?.message?.content || "{}");
  return normalizeToLegacySchema({ ...raw, engine: "openai-vision", fileName });
}

async function callOpenAIText(text: string, fileName: string): Promise<ClinicalExtractionResult> {
  const client = getOpenAIClient();
  if (!client) throw new Error("OPENAI_API_KEY não configurada no servidor.");

  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: DOCUMENT_EXTRACTION_PROMPT },
      {
        role: "user",
        content: `Texto do documento médico:\n\n${text}`,
      },
    ],
  });

  const raw = JSON.parse(response.choices[0]?.message?.content || "{}");
  return normalizeToLegacySchema({ ...raw, engine: "openai-direct", fileName, markdown: text });
}

// ─── File Processors ─────────────────────────────────────────────────────────

async function processImage(filePath: string, ext: string, fileName: string, jobId: string): Promise<ClinicalExtractionResult> {
  updateJob(jobId, { stage: "Preparando imagem..." });

  // Read and encode to base64 — browser sends file, we process as-is
  // Pillow-style resizing not available in Node, but we limit via sharp if installed
  // For now: read raw, send to Vision directly (safe for most phone photos)
  const imageBuffer = fs.readFileSync(filePath);
  const imageBase64 = imageBuffer.toString("base64");
  
  // Map extension to MIME type
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    heic: "image/heic",
    heif: "image/heif",
  };
  const mimeType = mimeMap[ext] || "image/jpeg";

  updateJob(jobId, { stage: "Lendo com IA (OpenAI Vision)..." });
  return callOpenAIVision(imageBase64, mimeType, fileName);
}

async function processText(filePath: string, fileName: string, jobId: string): Promise<ClinicalExtractionResult> {
  updateJob(jobId, { stage: "Lendo texto do arquivo..." });
  const text = fs.readFileSync(filePath, "utf-8");
  if (!text.trim()) throw new Error("Arquivo de texto está vazio.");
  updateJob(jobId, { stage: "Lendo com IA..." });
  return callOpenAIText(text, fileName);
}

async function processDocx(filePath: string, fileName: string, jobId: string): Promise<ClinicalExtractionResult> {
  updateJob(jobId, { stage: "Extraindo texto do DOCX..." });
  // Dynamic import of mammoth (listed in root package.json)
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.extractRawText({ path: filePath });
  const text = result.value;
  if (!text.trim()) throw new Error("Documento DOCX não contém texto legível.");
  updateJob(jobId, { stage: "Lendo com IA..." });
  return callOpenAIText(text, fileName);
}

async function processPdf(filePath: string, fileName: string, jobId: string): Promise<ClinicalExtractionResult> {
  updateJob(jobId, { stage: "Extraindo texto do PDF..." });

  // Try pdfjs-dist text extraction first
  let extractedText = "";
  try {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.js");
    const data = fs.readFileSync(filePath);
    const pdf = await (pdfjsLib as any).getDocument({ data: new Uint8Array(data) }).promise;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      extractedText += content.items.map((item: any) => item.str).join(" ") + "\n";
    }
  } catch (e) {
    console.warn("[documentExtractor] pdfjs falhou:", e);
  }

  if (extractedText.trim().length >= 100) {
    updateJob(jobId, { stage: "Lendo com IA..." });
    return callOpenAIText(extractedText.trim(), fileName);
  }

  // PDF seems scanned — return a clear alert in the result
  updateJob(jobId, { stage: "PDF escaneado detectado — retornando alerta..." });
  return normalizeToLegacySchema({
    alertas: [
      "PDF ESCANEADO: o texto extraído possui menos de 100 caracteres.",
      "O suporte a PDF escaneado (OCR via Vision) será adicionado na Etapa 2.",
      "Por enquanto, tire uma FOTO ou use um PDF com texto selecionável.",
    ],
    engine: "none",
    fileName,
    raw_summary: "PDF escaneado — processamento via Vision disponível na Etapa 2.",
  });
}

// ─── Main Background Processor ───────────────────────────────────────────────

export async function processFileInBackground(jobId: string, filePath: string, originalName: string): Promise<void> {
  const ext = path.extname(originalName).toLowerCase().replace(".", "");

  try {
    updateJob(jobId, { status: "processing", stage: "Identificando tipo de arquivo..." });

    let result: ClinicalExtractionResult;

    const imageExts = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"];
    const textExts = ["txt", "md"];
    const docExts = ["doc", "docx"];
    const pdfExts = ["pdf"];

    if (imageExts.includes(ext)) {
      result = await processImage(filePath, ext, originalName, jobId);
    } else if (textExts.includes(ext)) {
      result = await processText(filePath, originalName, jobId);
    } else if (docExts.includes(ext)) {
      result = await processDocx(filePath, originalName, jobId);
    } else if (pdfExts.includes(ext)) {
      result = await processPdf(filePath, originalName, jobId);
    } else {
      throw new Error(`Tipo de arquivo não suportado: .${ext}`);
    }

    updateJob(jobId, {
      status: "done",
      stage: "Pronto para revisão",
      result,
    });
  } catch (err: any) {
    console.error(`[documentExtractor] Job ${jobId} falhou:`, err);
    updateJob(jobId, {
      status: "error",
      stage: "Erro no processamento",
      error: err?.message || "Erro desconhecido no processamento do arquivo.",
    });
  } finally {
    // Clean up temp file
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // ignore cleanup errors
    }
  }
}
