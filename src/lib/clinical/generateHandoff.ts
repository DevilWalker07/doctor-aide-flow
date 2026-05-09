import type { ClinicalPatient, HandoffRow } from "./types";
import { detectClinicalRisks } from "./detectClinicalRisks";

function compact(items: Array<string | undefined | null>, fallback = "[NÃO INFORMADO]") {
  const clean = items.map((item) => item?.trim()).filter(Boolean) as string[];
  return clean.length ? clean.join("; ") : fallback;
}

export function summarizePatientForHandoff(patient: ClinicalPatient): HandoffRow {
  const risks = detectClinicalRisks(patient);
  const highRisk = risks.some((risk) => risk.severity === "ALTA");
  const hasAtb = patient.antibiotics.length > 0;

  const problemList = compact(
    patient.problems.map((problem) => {
      const suffix = problem.status === "RESOLVIDO" ? " (RESOLVIDO)" : "";
      return `${problem.name}${suffix}`;
    }),
  );

  const antibiotics = hasAtb
    ? patient.antibiotics
        .map((atb) => `${atb.name}${atb.currentDay ? ` ${atb.currentDay}` : ""}${atb.plannedDurationDays ? `/${atb.plannedDurationDays}` : ""}`)
        .join(" + ")
    : "sem ATB";

  const otherMeds = patient.medications.slice(0, 8).map((med) => med.name).join("; ");
  const medications = otherMeds ? `ATB: ${antibiotics}. Outros: ${otherMeds}.` : `ATB: ${antibiotics}.`;

  const admissionReason = compact([
    patient.admission.origin,
    patient.admission.reason,
    patient.admission.summary,
  ]);

  const pendingAndWhatToEvaluate = compact([
    ...patient.pendingIssues,
    ...patient.safetyAlerts,
    ...risks.map((risk) => risk.suggestedAction),
  ], "Sem pendências registradas. Reavaliar intercorrências, sinais vitais e exame físico.");

  return {
    patient: patient.identification.name || "[NÃO INFORMADO]",
    problemList,
    medications,
    admissionReason,
    pendingAndWhatToEvaluate,
    priority: highRisk ? "ALTA" : hasAtb ? "MEDIA" : "BAIXA",
  };
}

export function generateHandoffRows(patients: ClinicalPatient[]): HandoffRow[] {
  return patients.map(summarizePatientForHandoff);
}

export function generateHandoffMarkdown(patients: ClinicalPatient[]) {
  const header = "| PACIENTE | LISTA DE PROBLEMAS | MEDICAÇÕES EM USO | MOTIVO DA ADMISSÃO | PENDÊNCIAS / CONDUTAS / O QUE AVALIAR |\n|---|---|---|---|---|";
  const rows = generateHandoffRows(patients).map((row) =>
    `| **${row.patient}** | ${row.problemList} | ${row.medications} | ${row.admissionReason} | ${row.pendingAndWhatToEvaluate} |`,
  );
  return [header, ...rows].join("\n");
}
