import type { Patient } from "@/lib/store";
import type { ClinicalPatient } from "./types";
import { calculateAntibioticDay } from "./calculateAntibioticDay";
import { riskTexts } from "./detectClinicalRisks";

export function patientToClinicalPatient(patient: Patient, referenceDate = new Date().toISOString().slice(0, 10)): ClinicalPatient {
  const data = patient.data ?? {};
  const problems = data.conducta?.dx
    ? data.conducta.dx.split(/[;\n]/).map((p) => p.trim()).filter(Boolean)
    : patient.hda
      ? [patient.hda]
      : [];

  const antibiotics = (data.abx ?? []).map((abx) => {
    const day = calculateAntibioticDay({
      startDate: abx.d0,
      referenceDate,
      frequency: abx.freq,
    });

    return {
      name: abx.name,
      dose: abx.dose,
      route: abx.via,
      frequency: abx.freq,
      startDate: abx.d0,
      currentDay: day.day,
      status: "EM_USO" as const,
      plannedDurationDays: abx.durDays,
    };
  });

  const clinical: ClinicalPatient = {
    id: patient.id,
    identification: {
      name: patient.name,
      age: patient.age,
      sex: patient.sex,
      admissionDate: patient.admission,
      unit: patient.sector,
      ward: patient.sector,
      bed: patient.bed,
    },
    problems: problems.map((name) => ({ name, status: "ATIVO" as const })),
    admission: {
      reason: patient.hda,
      summary: patient.hda,
    },
    currentStatus: {
      hemodynamics: data.status?.hemo,
      respiratory: data.resp?.padrao,
      oxygen: data.resp?.suporte,
      diet: data.digest?.tipo,
      diuresis: data.diurese?.padrao,
      bowelMovements: data.digest?.dejecoes,
      fever: data.outros?.distermia ? "DISTERMIA" : undefined,
      clinicalEvolution: data.conducta?.condutas,
      complications: data.conducta?.intercorrencias,
    },
    physicalExam: {
      general: data.exam?.ect,
      cardiovascular: data.exam?.acv,
      respiratory: data.exam?.ar,
      abdomen: data.exam?.abd,
      extremities: data.exam?.ext,
    },
    labs: data.lab ? [{ date: data.lab.date, compactText: data.lab.formatted }] : [],
    imaging: [],
    antibiotics,
    medications: [],
    pendingIssues: data.conducta?.pendencias ? [data.conducta.pendencias] : [],
    safetyAlerts: [],
    uncertainFields: [],
  };

  clinical.safetyAlerts = riskTexts(clinical);
  return clinical;
}
