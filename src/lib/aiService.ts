// Serviço de IA do DOUTOR AJUDA — chama edge functions do Lovable Cloud
// As edge functions usam Lovable AI Gateway internamente. Nenhuma chave fica no frontend.
import { supabase } from "@/integrations/supabase/client";
import type { PatientData, Patient } from "@/lib/store";

export type AILabResult = {
  data_exame: string | null;
  tipo_exame: string[];
  valores: {
    hb: number | null;
    ht: number | null;
    leucocitos: number | null;
    segmentados_percent: number | null;
    bastoes_percent: number | null;
    plaquetas: number | null;
    creatinina: number | null;
    ureia: number | null;
    sodio: number | null;
    potassio: number | null;
    pcr: number | null;
    eas_piocitos: string | null;
    eas_nitrito: string | null;
  };
  texto_formatado: string | null;
  eas_formatado: string | null;
  alertas: string[];
  valores_duvidosos: string[];
  campos_nao_encontrados: string[];
};

export async function extractLabWithAI(
  inputText: string,
  patientContext?: { age?: number; sex?: string },
): Promise<AILabResult> {
  const { data, error } = await supabase.functions.invoke("lab-extractor", {
    body: { inputText, patientContext: patientContext ?? {} },
  });
  if (error) throw new Error(error.message || "Falha ao chamar lab-extractor");
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as AILabResult;
}

export type EvolutionPayload = {
  patient: Pick<Patient, "name" | "age" | "sex" | "bed" | "sector" | "admission" | "hda">;
  data: PatientData;
  egfr: number;
  stage: { stage: string; label: string } | null;
  abxDay: number;
};

export async function generateEvolutionWithAI(payload: EvolutionPayload): Promise<string> {
  const { data, error } = await supabase.functions.invoke("evolution-generator", {
    body: payload,
  });
  if (error) throw new Error(error.message || "Falha ao chamar evolution-generator");
  if ((data as any)?.error) throw new Error((data as any).error);
  return (data as { evolution_text: string }).evolution_text;
}

// ---------------- Persistência ----------------

export async function saveLabExam(patientId: string, ai: AILabResult) {
  const v = ai.valores;
  const { error } = await supabase.from("lab_exams").insert({
    patient_id: patientId,
    exam_date: ai.data_exame,
    source: "TEXTO_IA",
    hb: v.hb,
    ht: v.ht,
    leukocytes: v.leucocitos,
    segmented_percent: v.segmentados_percent,
    bands_percent: v.bastoes_percent,
    platelets: v.plaquetas,
    creatinine: v.creatinina,
    urea: v.ureia,
    sodium: v.sodio,
    potassium: v.potassio,
    crp: v.pcr,
    eas_piocitos: v.eas_piocitos,
    eas_nitrite: v.eas_nitrito,
    formatted_text: ai.texto_formatado,
    eas_formatted: ai.eas_formatado,
    alerts_json: ai.alertas,
    raw_ai_response_json: ai as unknown as Record<string, unknown>,
  });
  if (error) console.warn("Falha ao salvar lab_exam (mantendo apenas local):", error.message);
}

export async function saveEvolution(patientId: string, text: string, generatedBy: "AI" | "TEMPLATE" = "AI") {
  const { error } = await supabase.from("evolutions").insert({
    patient_id: patientId,
    evolution_text: text,
    generated_by: generatedBy,
  });
  if (error) console.warn("Falha ao salvar evolução (mantendo apenas local):", error.message);
}

export async function persistPatient(p: Patient) {
  // upsert simples no backend; ignora erro silenciosamente se UUID não bater (paciente seed local)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.id);
  if (!isUuid) return;
  const { error } = await supabase.from("patients").upsert({
    id: p.id,
    name: p.name,
    age: p.age,
    sex: p.sex,
    bed: p.bed,
    ward: p.sector,
    unit: p.sector,
    admission_date: p.admission || null,
    hda: p.hda,
    status: p.status,
    data_json: (p.data ?? {}) as unknown as Record<string, unknown>,
  });
  if (error) console.warn("Falha ao persistir paciente:", error.message);
}

export async function createPatientRemote(p: Omit<Patient, "id" | "status">): Promise<string | null> {
  const { data, error } = await supabase
    .from("patients")
    .insert({
      name: p.name,
      age: p.age,
      sex: p.sex,
      bed: p.bed,
      ward: p.sector,
      unit: p.sector,
      admission_date: p.admission || null,
      hda: p.hda,
      status: "PENDENTE",
    })
    .select("id")
    .single();
  if (error) {
    console.warn("Falha ao criar paciente no backend (mantendo só local):", error.message);
    return null;
  }
  return data?.id ?? null;
}