import type { LabExtractionResult } from "../types/lab";
import type { MotorLuanDocumentResult } from "../types/motorLuan";
import type { ImportedRoundPatient } from "../types/round";
import { fallbackEvolution, fallbackLabExtraction, gerarBriefingLocal, gerarMapaPassagemPlantao } from "./localFallbacks";
import { mockImportedPatients } from "./mocks";

import { VITE_CLINICAL_AGENTS_URL } from "../clinicalAgentsConfig";

const AI_BACKEND_URL = VITE_CLINICAL_AGENTS_URL.replace(/\/$/, "");

async function postBackend<T>(path: string, body: unknown): Promise<T> {
  if (!AI_BACKEND_URL) throw new Error("Backend de IA não configurado.");
  const response = await fetch(`${AI_BACKEND_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || `Backend indisponível (${response.status}).`);
  }
  return response.json();
}

export async function processDocumentsWithMotorLuan(rawText: string, context?: unknown): Promise<MotorLuanDocumentResult> {
  try {
    return await postBackend<MotorLuanDocumentResult>("/api/ai/orquestrador", { rawText, context });
  } catch (error) {
    console.warn("Motor Luan indisponível, usando mock local.", error);
    return { agent: "orquestrador", patients: mockImportedPatients(), globalAlerts: ["MODO MOCK LOCAL"] };
  }
}

export async function generateEvolutionWithMotorLuan(payload: unknown): Promise<string> {
  try {
    const response = await postBackend<{ text?: string; evolutionText?: string }>("/api/ai/gerar-evolucao", payload);
    return (response.text || response.evolutionText || fallbackEvolution(payload)).toUpperCase();
  } catch (error) {
    console.warn("Gerador de evolução indisponível, usando fallback local.", error);
    return fallbackEvolution(payload);
  }
}

export async function importYesterdayEvolutions(rawText: string, context?: unknown) {
  try {
    return await postBackend<{ patients: ImportedRoundPatient[]; globalAlerts: string[] }>("/api/ai/importar-evolucoes-ontem", { rawText, context });
  } catch (error) {
    console.warn("Importação de evoluções indisponível, usando mock local.", error);
    return { patients: mockImportedPatients(), globalAlerts: ["MODO MOCK LOCAL"] };
  }
}

export async function generateRoundMap(patients: ImportedRoundPatient[], sector: string, date: string) {
  try {
    const response = await postBackend<{ text?: string }>("/api/ai/gerar-mapa-plantao", { patients, sector, date });
    return response.text || gerarMapaPassagemPlantao(patients, sector, date);
  } catch {
    return gerarMapaPassagemPlantao(patients, sector, date);
  }
}

export async function generateBriefing(patients: ImportedRoundPatient[], sector: string, date: string) {
  try {
    const response = await postBackend<{ text?: string }>("/api/ai/gerar-briefing", { patients, sector, date });
    return response.text || gerarBriefingLocal(patients, sector, date);
  } catch {
    return gerarBriefingLocal(patients, sector, date);
  }
}

export async function extractLabWithAI(inputText: string, patientContext?: unknown): Promise<LabExtractionResult> {
  try {
    return await postBackend<LabExtractionResult>("/api/ai/extrair-clinica-medica", { inputText, patientContext, task: "lab-extractor" });
  } catch (error) {
    console.warn("Extração de laboratório indisponível, usando fallback local.", error);
    return fallbackLabExtraction(inputText);
  }
}

export const generateEvolutionWithAI = generateEvolutionWithMotorLuan;
export const importYesterdayEvolutionsWithAI = importYesterdayEvolutions;
export const generateRoundMapWithAI = generateRoundMap;
export const generateBriefingWithAI = generateBriefing;
export { gerarBriefingLocal, gerarMapaPassagemPlantao };
export type { ImportedRoundPatient };
