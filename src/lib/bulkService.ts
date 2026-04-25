import { supabase, hasSupabaseConfig } from "./supabase";
import { type Patient } from "./store";

// Mock Fallback para Importação em Lote
const MOCK_BULK_RESPONSE = {
  pacientes: [
    {
      name: "JOÃO PEDRO DOS SANTOS",
      age: 55,
      sex: "M",
      bed: "L12",
      sector: "CLÍNICA MÉDICA MASCULINA",
      hda: "PACIENTE ADMITIDO POR QUADRO DE DISPNEIA E TOSSE PRODUTIVA HÁ 3 DIAS. SUSPEITA DE PNEUMONIA COMUNITÁRIA."
    },
    {
      name: "MARIA CLARA DE ASSIS",
      age: 72,
      sex: "F",
      bed: "L14",
      sector: "CLÍNICA MÉDICA FEMININA",
      hda: "DEU ENTRADA COM DOR TORÁCICA ATÍPICA E PALPITAÇÕES. ECG COM FA DE ALTA RESPOSTA. AGUARDA ECOCARDIOGRAMA."
    }
  ]
};

export async function extractBulkPatientsWithAI(text: string, sector: string): Promise<Omit<Patient, "id" | "status">[]> {
  if (!hasSupabaseConfig) {
    console.warn("Sem Supabase configurado. Retornando mock de pacientes em lote.");
    return new Promise(resolve => setTimeout(() => resolve(MOCK_BULK_RESPONSE.pacientes as any), 3000));
  }

  const { data, error } = await supabase.functions.invoke("bulk-patient-extractor", {
    body: { text, sector },
  });

  if (error) {
    console.error("Erro na Edge Function de bulk:", error);
    throw new Error(error.message);
  }

  return data.pacientes;
}
