export type LabExam = {
  id: string;
  patientId: string;
  examDate?: string;
  formattedText?: string;
  hb?: number | null;
  ht?: number | null;
  leukocytes?: number | null;
  segmentedPercent?: number | null;
  bandsPercent?: number | null;
  platelets?: number | null;
  creatinine?: number | null;
  urea?: number | null;
  sodium?: number | null;
  potassium?: number | null;
  crp?: number | null;
  easPiocitos?: number | null;
  easNitrite?: string | null;
  alerts?: string[];
  raw?: unknown;
};

export type LabExtractionResult = {
  data_exame?: string;
  tipo_exame?: string;
  valores?: Record<string, string | null>;
  texto_formatado?: string;
  eas_formatado?: string;
  alertas?: string[];
  valores_duvidosos?: string[];
  campos_nao_encontrados?: string[];
  [key: string]: unknown;
};
