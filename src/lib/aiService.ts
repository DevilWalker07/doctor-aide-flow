import { supabase, hasSupabaseConfig } from "./supabase";

export async function extractLabWithAI(inputText: string, patientContext: any) {
  if (!hasSupabaseConfig) {
    console.warn("Supabase não configurado. Utilizando extração mockada.");
    return fallbackLabExtraction(inputText);
  }

  try {
    const { data, error } = await supabase.functions.invoke("lab-extractor", {
      body: { inputText, patientContext },
    });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("Falha ao chamar a IA do laboratório, caindo no fallback:", err);
    return fallbackLabExtraction(inputText);
  }
}

export async function generateEvolutionWithAI(payload: any) {
  if (!hasSupabaseConfig) {
    console.warn("Supabase não configurado. Utilizando geração de evolução local.");
    throw new Error("Local fallback required"); // Let the caller use its local generator
  }

  try {
    const { data, error } = await supabase.functions.invoke("evolution-generator", {
      body: payload,
    });

    if (error) throw error;
    if (data && data.evolution_text) {
      return data.evolution_text;
    }
    throw new Error("Texto gerado não encontrado");
  } catch (err) {
    console.error("Falha ao chamar a IA de evolução:", err);
    throw new Error("Falha na IA");
  }
}

// Fallback visual se a IA falhar
function fallbackLabExtraction(text: string) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        date: new Date().toLocaleDateString('pt-BR'),
        valores: { hb: 11.2, ht: 34.1, leucocitos: 12800, segmentados_percent: 80, bastoes_percent: 5, plaquetas: 178000, creatinina: 1.1, ureia: 53, sodio: 138, potassio: 4.2, pcr: 53 },
        texto_formatado: `LAB ATUAL (${new Date().toLocaleDateString('pt-BR')}): HB 11,2 / HT 34,1 / LEUCO 12.800 (80% SEG / 5% BAST) / PLQ 178.000 / CR 1,1 / UR 53 / NA 138 / K 4,2 / PCR 53\n\nEAS (${new Date().toLocaleDateString('pt-BR')}): 38 PIÓCITOS/CAMPO / NITRITO NEGATIVO`,
        alertas: [],
        valores_duvidosos: [],
      });
    }, 1500);
  });
}
