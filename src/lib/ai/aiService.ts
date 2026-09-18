import type { LabExtractionResult, LaudoImagemResult } from "../types/lab";
import type { MotorLuanDocumentResult } from "../types/motorLuan";
import type { ImportedRoundPatient } from "../types/round";
import {
  fallbackEvolution,
  fallbackLabExtraction,
  gerarBriefingLocal,
  gerarMapaPassagemPlantao,
} from "./localFallbacks";
import { mockImportedPatients } from "./mocks";

import { apiJson } from "../apiClient";

const postBackend = <T>(path: string, body: unknown) => apiJson<T>(path, body);

export interface EvolutionReview {
  campos_faltantes: string[];
  inconsistencias: string[];
  alertas: string[];
  sugestoes: string[];
}

export function reviewEvolution(
  evolutionText: string,
  patient?: unknown,
): Promise<EvolutionReview> {
  return postBackend<EvolutionReview>("/api/ai/revisar-evolucao", { evolutionText, patient });
}

export async function processDocumentsWithMotorLuan(
  rawText: string,
  context?: unknown,
): Promise<MotorLuanDocumentResult> {
  try {
    return await postBackend<MotorLuanDocumentResult>("/api/ai/orquestrador", { rawText, context });
  } catch (error) {
    console.warn("Motor Luan indisponível, usando mock local.", error);
    return {
      agent: "orquestrador",
      patients: mockImportedPatients(),
      globalAlerts: ["MODO MOCK LOCAL"],
    };
  }
}

export async function generateEvolutionWithMotorLuan(payload: unknown): Promise<string> {
  try {
    const response = await postBackend<{ text?: string; evolutionText?: string }>(
      "/api/ai/gerar-evolucao",
      payload,
    );
    return (response.text || response.evolutionText || fallbackEvolution(payload)).toUpperCase();
  } catch (error) {
    console.warn("Gerador de evolução indisponível, usando fallback local.", error);
    return fallbackEvolution(payload);
  }
}

export async function importYesterdayEvolutions(rawText: string, context?: unknown) {
  try {
    return await postBackend<{ patients: ImportedRoundPatient[]; globalAlerts: string[] }>(
      "/api/ai/importar-evolucoes-ontem",
      { rawText, context },
    );
  } catch (error) {
    console.warn("Importação de evoluções indisponível, usando mock local.", error);
    return { patients: mockImportedPatients(), globalAlerts: ["MODO MOCK LOCAL"] };
  }
}

export async function generateRoundMap(
  patients: ImportedRoundPatient[],
  sector: string,
  date: string,
) {
  try {
    const response = await postBackend<{ text?: string }>("/api/ai/gerar-mapa-plantao", {
      patients,
      sector,
      date,
    });
    return response.text || gerarMapaPassagemPlantao(patients, sector, date);
  } catch {
    return gerarMapaPassagemPlantao(patients, sector, date);
  }
}

export async function generateBriefing(
  patients: ImportedRoundPatient[],
  sector: string,
  date: string,
) {
  try {
    const response = await postBackend<{ text?: string }>("/api/ai/gerar-briefing", {
      patients,
      sector,
      date,
    });
    return response.text || gerarBriefingLocal(patients, sector, date);
  } catch {
    return gerarBriefingLocal(patients, sector, date);
  }
}

/**
 * Organiza laboratório na linha do prontuário.
 *
 * Aceita texto, imagens (foto do papel, print da tela) e PDF. Rota própria:
 * antes isto ia para `/api/ai/extrair-clinica-medica` com
 * `task: "lab-extractor"`, escondido atrás de outro endpoint.
 *
 * O fallback local só vale quando há texto — não existe como montar a linha
 * a partir de uma foto sem a IA, e devolver linha vazia seria pior que falhar.
 */
export async function organizarLaboratorio(entrada: {
  inputText?: string;
  imagens?: { base64: string; mime: string }[];
  pdfBase64?: string;
  patientContext?: unknown;
}): Promise<LabExtractionResult> {
  try {
    return await postBackend<LabExtractionResult>("/api/ai/organizar-laboratorio", entrada);
  } catch (error) {
    if (entrada.inputText?.trim()) {
      console.warn("Organização de laboratório indisponível, usando fallback local.", error);
      return fallbackLabExtraction(entrada.inputText);
    }
    throw error;
  }
}

/**
 * Organiza um laudo de imagem. Diferente do laboratório, aqui NÃO há fallback
 * local: extrair achados de um laudo por heurística geraria texto clínico que
 * ninguém escreveu. Falha da IA falha a chamada.
 */
export async function organizarLaudoImagem(inputText: string): Promise<LaudoImagemResult> {
  return postBackend<LaudoImagemResult>("/api/ai/organizar-laudo-imagem", { inputText });
}

export const generateEvolutionWithAI = generateEvolutionWithMotorLuan;
export const importYesterdayEvolutionsWithAI = importYesterdayEvolutions;
export const generateRoundMapWithAI = generateRoundMap;
export const generateBriefingWithAI = generateBriefing;
export { gerarBriefingLocal, gerarMapaPassagemPlantao };
export type { ImportedRoundPatient };
