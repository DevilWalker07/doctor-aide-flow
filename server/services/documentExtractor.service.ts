import fs from "node:fs/promises";
import { env } from "../config.js";
import { AIResponseError } from "../lib/errors.js";
import { extOf, readTextFile, safeUnlink } from "../lib/files.js";
import { DOCUMENT_EXTRACTION_PROMPT } from "../prompts/documentExtraction.prompt.js";
import { DocumentExtractionSchema, type DocumentExtraction } from "../schemas/ai.schemas.js";
import { normalizeImageToJpeg } from "./image.service.js";
import type { JobStore } from "./jobStore.js";
import { safeJsonCompletion } from "./openaiClient.js";
import { extractPdfText, renderPdfPagesToJpeg } from "./pdf.service.js";

export interface ClinicalExtractionResult extends DocumentExtraction {
  patient_identification: Record<string, unknown>;
  clinical_data: Record<string, unknown>;
  suggested_patient: Record<string, unknown>;
  safety_alerts: string[];
  uncertain_fields: string[];
  raw_summary: string;
  engine: string;
  fileName?: string;
  markdown?: string;
}

const MIN_TEXT_CHARS = 100;
const MAX_TEXT_CHARS = 60_000;

export function normalizeToLegacySchema(
  simple: DocumentExtraction & { engine: string; fileName?: string; markdown?: string; extraAlerts?: string[] },
): ClinicalExtractionResult {
  const { engine, fileName, markdown, extraAlerts = [], ...data } = simple;
  const alertas = [...data.alertas, ...extraAlerts];
  const uncertain = (["nome", "idade", "sexo", "leito", "setor"] as const).filter((k) => data[k] == null);

  return {
    ...data,
    alertas,
    patient_identification: {
      nome: data.nome,
      idade: data.idade,
      sexo: data.sexo,
      leito: data.leito,
      setor: data.setor,
    },
    clinical_data: {
      hda: data.hda,
      lista_de_problemas: data.lista_de_problemas,
      antibioticos: data.antibioticos,
      medicacoes: data.medicacoes,
      laboratorios: data.laboratorios,
      exame_fisico: data.exame_fisico,
      condutas: data.condutas,
      pendencias: data.pendencias,
    },
    suggested_patient: {
      bed: data.leito ?? "",
      name: data.nome ?? "",
      age: data.idade,
      sex: data.sexo ?? "",
      sector: data.setor ?? "",
      hda: data.hda ?? "",
      diagnoses: data.lista_de_problemas,
      alerts: alertas,
    },
    safety_alerts: alertas,
    uncertain_fields: uncertain,
    raw_summary: data.hda ?? "",
    engine,
    fileName,
    markdown,
  };
}

async function runExtraction(
  payload: unknown,
  images?: { base64: string; mime: string }[],
): Promise<DocumentExtraction> {
  const result = await safeJsonCompletion(DOCUMENT_EXTRACTION_PROMPT, payload, DocumentExtractionSchema, {
    images,
    mockKey: "documentExtraction",
    maxTokens: 3000,
  });
  if (!result.ok) throw new AIResponseError(result.error, result.raw);
  return result.data;
}

type Stage = (stage: string) => Promise<void>;

async function processImage(filePath: string, ext: string, fileName: string, setStage: Stage) {
  await setStage("Preparando imagem...");
  const image = await normalizeImageToJpeg(await fs.readFile(filePath), ext);
  await setStage("Lendo com IA (Vision)...");
  const data = await runExtraction({ fileName, instrucao: "Extraia os dados clínicos desta imagem médica." }, [image]);
  return normalizeToLegacySchema({ ...data, engine: "openai-vision", fileName });
}

async function processTextContent(text: string, fileName: string, engine: string, setStage: Stage, extraAlerts: string[] = []) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Documento não contém texto legível.");
  const clipped = trimmed.length > MAX_TEXT_CHARS ? trimmed.slice(0, MAX_TEXT_CHARS) : trimmed;
  if (clipped.length < trimmed.length) extraAlerts = [...extraAlerts, "DOCUMENTO TRUNCADO: texto muito longo, apenas o início foi analisado."];

  await setStage("Organizando dados clínicos com IA...");
  const data = await runExtraction({ fileName, texto: clipped });
  return normalizeToLegacySchema({ ...data, engine, fileName, markdown: clipped, extraAlerts });
}

async function processText(filePath: string, fileName: string, setStage: Stage) {
  await setStage("Lendo texto...");
  return processTextContent(await readTextFile(filePath), fileName, "openai-direct", setStage);
}

async function processDocx(filePath: string, fileName: string, setStage: Stage) {
  await setStage("Lendo documento...");
  const mammoth = (await import("mammoth")).default;
  const { value } = await mammoth.extractRawText({ path: filePath });
  return processTextContent(value, fileName, "openai-direct", setStage);
}

async function processPdf(filePath: string, fileName: string, setStage: Stage) {
  await setStage("Lendo PDF...");
  const buf = await fs.readFile(filePath);
  const { text } = await extractPdfText(buf);

  if (text.trim().length >= MIN_TEXT_CHARS) {
    return processTextContent(text, fileName, "openai-direct-pdf", setStage);
  }

  await setStage("PDF escaneado — processando páginas (OCR via IA)...");
  const { images, totalPages, rendered } = await renderPdfPagesToJpeg(buf, env.MAX_PDF_PAGES);
  if (images.length === 0) throw new Error("PDF sem páginas renderizáveis.");

  const extraAlerts = rendered < totalPages ? [`PDF TRUNCADO: ${rendered} DE ${totalPages} PÁGINAS PROCESSADAS.`] : [];
  const payload = { fileName, instrucao: `Extraia os dados clínicos destas ${rendered} páginas de um documento médico escaneado.` };
  const data = await runExtraction(
    payload,
    images.map((b) => ({ base64: b.toString("base64"), mime: "image/jpeg" })),
  );
  return normalizeToLegacySchema({ ...data, engine: "openai-vision-pdf", fileName, extraAlerts });
}

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);
const TEXT_EXTS = new Set(["txt", "md"]);

export interface ProcessArgs {
  jobId: string;
  filePath: string;
  originalName: string;
  store: JobStore;
}

export async function processFileInBackground({ jobId, filePath, originalName, store }: ProcessArgs): Promise<void> {
  const ext = extOf(originalName);
  const setStage: Stage = (stage) => store.update(jobId, { status: "processing", stage });

  try {
    await setStage("Identificando tipo de arquivo...");

    let result: ClinicalExtractionResult;
    if (IMAGE_EXTS.has(ext)) result = await processImage(filePath, ext, originalName, setStage);
    else if (TEXT_EXTS.has(ext)) result = await processText(filePath, originalName, setStage);
    else if (ext === "docx") result = await processDocx(filePath, originalName, setStage);
    else if (ext === "pdf") result = await processPdf(filePath, originalName, setStage);
    else throw new Error(`Tipo de arquivo não suportado: .${ext}`);

    await store.update(jobId, { status: "done", stage: "Pronto para revisão", result, error: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido no processamento do arquivo.";
    console.error(`[documentExtractor] job ${jobId} falhou:`, err);
    await store.update(jobId, { status: "error", stage: "Erro na extração", error: message });
  } finally {
    await safeUnlink(filePath);
  }
}
