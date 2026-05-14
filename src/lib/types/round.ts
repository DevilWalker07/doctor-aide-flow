export type ImportedRoundPatient = {
  id: string;
  leito: string;
  nome: string;
  idade: string;
  sexo: string;
  diagnosticos: string;
  comorbidades?: string;
  dispositivos: string;
  antibioticos: string;
  laboratorio: string;
  quadro: string;
  intercorrencias: string;
  pendencias: string;
  alertas: string[];
  memory?: string[];
};

export type Shift = {
  id: string;
  date: string;
  sector?: string;
  workplace?: string;
  active: boolean;
  createdAt: string;
};

export type RoundMap = {
  id: string;
  date: string;
  sector?: string;
  text: string;
  patients: unknown[];
  alerts: string[];
  createdAt: string;
};

export type ImportedYesterdayEvolutions = {
  id: string;
  date: string;
  rawText: string;
  extractedPatients: unknown[];
  createdAt: string;
};
