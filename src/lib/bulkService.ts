import { importYesterdayEvolutionsWithAI } from "./aiService";
import { type Patient } from "./store";

export async function extractBulkPatientsWithAI(
  text: string,
  sector: string,
  filename = ""
): Promise<Omit<Patient, "id" | "status">[]> {
  const result = await importYesterdayEvolutionsWithAI(text, { sector, filename, mode: "bulk-patient-import" });

  return result.patients.map((p) => ({
    bed: p.leito || "L00",
    name: p.nome || "PACIENTE SEM NOME",
    age: Number(p.idade || 0),
    sex: p.sexo === "M" ? "M" : "F",
    sector,
    ward: sector,
    admission: new Date().toISOString().slice(0, 10),
    admissionDate: new Date().toISOString().slice(0, 10),
    hda: [p.diagnosticos, p.quadro, p.pendencias].filter(Boolean).join(" | "),
    diagnoses: p.diagnosticos ? [p.diagnosticos] : [],
    comorbidities: p.comorbidades ? [p.comorbidades] : [],
    devices: p.dispositivos ? [p.dispositivos] : [],
    currentStatus: p.quadro,
    pendingIssues: p.pendencias ? [p.pendencias] : [],
    alerts: p.alertas || [],
    tags: p.alertas || [],
    memory: p.memory || [],
    data: {
      lab: p.laboratorio ? { date: new Date().toLocaleDateString("pt-BR"), raw: {}, formatted: p.laboratorio } : undefined,
      conducta: {
        dx: p.diagnosticos,
        pendencias: p.pendencias,
        intercorrencias: p.intercorrencias,
      },
    },
  }));
}
