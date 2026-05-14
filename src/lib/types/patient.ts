export type Sex = "M" | "F";

export type PatientStatus = "PENDENTE" | "EVOLUÇÃO GERADA" | "ALERTA RENAL" | "ATB D4/7";

export type PatientData = {
  vitals?: { pas?: number; pad?: number; fc?: number; fr?: number; spo2?: number; temp?: number; pasMin?: number; pasMax?: number };
  hgt?: { h06?: number; h12?: number; h18?: number; h00?: number };
  status?: { geral?: string; clinica?: string; hemo?: string; consc?: string; glasgow?: number };
  resp?: { padrao?: string; suporte?: string; o2?: number; modo?: string; fio2?: number; peep?: number; vmFr?: number };
  digest?: { tolerancia?: string; tipo?: string; nauseas?: boolean; vomitos?: boolean; vomitoAspecto?: string; dejecoes?: string; flatos?: string; abdome?: string; dor?: string };
  diurese?: { padrao?: string; via?: string; aspecto?: string; debito?: number; bh?: string; bhValor?: number };
  outros?: { sono?: string; dor?: string; eva?: number; agitacao?: boolean; distermia?: boolean; pico?: number; disglicemia?: boolean };
  abx?: { name: string; dose: string; via: string; freq: string; d0: string; durDays: number }[];
  lab?: { date: string; raw: Record<string, string>; formatted: string };
  pcrHist?: number[];
  exam?: { ect?: string; acv?: string; ar?: string; abd?: string; ext?: string };
  conducta?: { dx?: string; condutas?: string; pendencias?: string; intercorrencias?: string };
  [key: string]: unknown;
};

export type Patient = {
  id: string;
  bed: string;
  name: string;
  age: number;
  sex: Sex;
  sector: string;
  ward?: string;
  admissionDate?: string;
  admission: string;
  dih?: number;
  diagnoses?: string[];
  comorbidities?: string[];
  devices?: string[];
  currentStatus?: string;
  pendingIssues?: string[];
  alerts?: string[];
  tags?: string[];
  memory?: string[];
  hda: string;
  status: PatientStatus;
  data?: PatientData;
};
