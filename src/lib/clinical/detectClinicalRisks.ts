import type { ClinicalPatient, ClinicalPriority } from "./types";

export type ClinicalRisk = {
  type: string;
  severity: ClinicalPriority;
  reason: string;
  suggestedAction: string;
};

export function detectClinicalRisks(patient: ClinicalPatient): ClinicalRisk[] {
  const risks: ClinicalRisk[] = [];
  const text = JSON.stringify(patient).toLowerCase();

  if (text.includes("sne") || text.includes("sonda nasoenteral")) {
    risks.push({
      type: "BRONCOASPIRACAO",
      severity: "MEDIA",
      reason: "Paciente com dieta por SNE ou risco de disfagia/broncoaspiracao.",
      suggestedAction: "Manter cabeceira elevada, cuidados com SNE e avaliar tosse/engasgos durante dieta.",
    });
  }

  if (text.includes("acamado") || text.includes("idoso fragil") || text.includes("idoso frágil")) {
    risks.push({
      type: "LPP",
      severity: "MEDIA",
      reason: "Paciente acamado ou idoso fragil.",
      suggestedAction: "Mudanca de decubito 2/2h, avaliar pele/sacro e manter cuidados de barreira.",
    });
  }

  if (text.includes("deficit motor") || text.includes("déficit motor") || text.includes("avc")) {
    risks.push({
      type: "NEUROLOGICO",
      severity: "ALTA",
      reason: "Deficit motor ou suspeita de evento neurologico agudo.",
      suggestedAction: "Avaliar Glasgow, fala, pupilas, forca, sensibilidade e degluticao antes de dieta VO; acompanhar TC/neuro.",
    });
  }

  if (text.includes("insuficiencia cardiaca") || text.includes("insuficiência cardíaca") || text.includes(" ic") || text.includes("ic;")) {
    risks.push({
      type: "SOBRECARGA_VOLEMICA",
      severity: "MEDIA",
      reason: "Paciente com IC ou risco de congestao.",
      suggestedAction: "Reavaliar soro de manutencao, balanco hidrico, edema e ausculta pulmonar.",
    });
  }

  if (
    text.includes("erisipela") ||
    text.includes("celulite") ||
    text.includes("bolhas") ||
    text.includes("necrose") ||
    text.includes("dor desproporcional")
  ) {
    risks.push({
      type: "INFECCAO_PROFUNDA_PARTES_MOLES",
      severity: "ALTA",
      reason: "Infeccao de partes moles com potencial de colecao, abscesso ou acometimento profundo.",
      suggestedAction: "Marcar bordas, fotografar lesao, elevar membro, avaliar perfusao distal e considerar USG/avaliacao cirurgica.",
    });
  }

  if (text.includes("svd") || text.includes("sonda vesical")) {
    risks.push({
      type: "RISCO_URINARIO",
      severity: "MEDIA",
      reason: "Paciente em uso de SVD ou com alteracao urinaria.",
      suggestedAction: "Monitorar diurese, grumos/coagulos, aspecto da urina, obstrucao e necessidade de EAS/urocultura.",
    });
  }

  return risks;
}

export function riskTexts(patient: ClinicalPatient): string[] {
  return detectClinicalRisks(patient).map((risk) => `${risk.type}: ${risk.suggestedAction}`);
}
