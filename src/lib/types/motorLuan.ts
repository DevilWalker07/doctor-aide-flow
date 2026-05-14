import type { LabExtractionResult } from "./lab";
import type { ImportedRoundPatient } from "./round";

export type MotorLuanAgent =
  | "orquestrador"
  | "clinica-medica"
  | "pediatria"
  | "uti"
  | "gerador-evolucao"
  | "mapa-plantao"
  | "briefing";

export type MotorLuanDocumentResult = {
  agent: MotorLuanAgent;
  patients: ImportedRoundPatient[];
  globalAlerts: string[];
  lab?: LabExtractionResult;
  raw?: unknown;
};

export type MotorLuanRequest = {
  text?: string;
  rawText?: string;
  inputText?: string;
  patientContext?: unknown;
  context?: unknown;
  patients?: ImportedRoundPatient[];
  sector?: string;
  date?: string;
};
