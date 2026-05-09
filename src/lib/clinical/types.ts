export type ClinicalPriority = "BAIXA" | "MEDIA" | "ALTA";

export type ProblemStatus = "ATIVO" | "RESOLVIDO" | "EM_INVESTIGACAO";

export type ClinicalPatient = {
  id?: string;
  identification: {
    name: string;
    motherName?: string;
    sex?: "M" | "F" | string;
    birthDate?: string;
    age?: number | string;
    admissionDate?: string;
    medicalRecord?: string;
    unit?: string;
    ward?: string;
    bed?: string;
  };
  problems: Array<{
    name: string;
    status?: ProblemStatus;
    severity?: ClinicalPriority;
  }>;
  admission: {
    reason?: string;
    origin?: string;
    summary?: string;
  };
  currentStatus?: {
    clinicalEvolution?: string;
    hemodynamics?: string;
    respiratory?: string;
    oxygen?: string;
    diet?: string;
    diuresis?: string;
    bowelMovements?: string;
    pain?: string;
    fever?: string;
    complications?: string;
  };
  physicalExam?: {
    general?: string;
    vitalSigns?: string;
    cardiovascular?: string;
    respiratory?: string;
    abdomen?: string;
    neuro?: string;
    extremities?: string;
    genitourinary?: string;
    skin?: string;
  };
  labs: Array<{
    date?: string;
    compactText: string;
    interpretation?: string;
  }>;
  imaging: Array<{
    date?: string;
    type: string;
    result: string;
  }>;
  antibiotics: Array<{
    name: string;
    dose?: string;
    route?: string;
    frequency?: string;
    startDate?: string;
    startTime?: string;
    currentDay?: string;
    status?: "EM_USO" | "SUSPENSO" | "FINALIZADO";
    plannedDurationDays?: number;
  }>;
  medications: Array<{
    name: string;
    dose?: string;
    route?: string;
    frequency?: string;
    indication?: string;
  }>;
  pendingIssues: string[];
  safetyAlerts: string[];
  uncertainFields: string[];
};

export type AntibioticDecisionInput = {
  diagnosis: string;
  antibiotics: ClinicalPatient["antibiotics"];
  clinical: {
    fever?: "SIM" | "NAO" | "PICO_ISOLADO";
    hemodynamics?: "ESTAVEL" | "INSTAVEL";
    respiratory?: "MELHOR" | "IGUAL" | "PIOR";
    pain?: "MELHOR" | "IGUAL" | "PIOR";
    focusControlled?: "SIM" | "NAO" | "INCERTO";
  };
  labs?: {
    leukocytes?: number;
    crp?: number;
    creatinine?: number;
  };
  severitySigns?: string[];
};

export type HandoffRow = {
  patient: string;
  problemList: string;
  medications: string;
  admissionReason: string;
  pendingAndWhatToEvaluate: string;
  priority: ClinicalPriority;
};
