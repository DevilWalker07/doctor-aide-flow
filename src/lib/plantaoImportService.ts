import {
  gerarBriefingLocal,
  gerarMapaPassagemPlantao,
  importYesterdayEvolutionsWithAI,
  type ImportedRoundPatient,
} from "./aiService";
import { saveImportedYesterdayEvolutions } from "./store";

export interface ImportedPatient extends ImportedRoundPatient {}

export const plantaoImportService = {
  processarTextoEvolucoes: async (text: string): Promise<ImportedPatient[]> => {
    const result = await importYesterdayEvolutionsWithAI(text, {
      product: "PLANTONISTA / HNAS ASSIST",
      mode: "round-import",
    });

    await saveImportedYesterdayEvolutions({
      id: "",
      date: new Date().toISOString().slice(0, 10),
      rawText: text,
      extractedPatients: result.patients,
      createdAt: new Date().toISOString(),
    });

    return result.patients;
  },

  gerarTextoMapa: (pacientes: ImportedPatient[], setor: string): string => {
    return gerarMapaPassagemPlantao(pacientes, setor, new Date().toLocaleDateString("pt-BR"));
  },

  gerarBriefing: (pacientes: ImportedPatient[], setor: string): string => {
    return gerarBriefingLocal(pacientes, setor, new Date().toLocaleDateString("pt-BR"));
  },
};
