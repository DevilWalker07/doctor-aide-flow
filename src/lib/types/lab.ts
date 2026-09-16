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

/**
 * Laudo de imagem organizado pelo agente. Os achados e a conclusão são do
 * radiologista — o agente compacta, não interpreta.
 */
export type LaudoImagemResult = {
  tipo_exame?: string | null;
  regiao?: string | null;
  data_exame?: string | null;
  achados?: string[];
  conclusao?: string | null;
  comparacao?: string | null;
  texto_formatado?: string;
  alertas?: string[];
  achados_incertos?: string[];
  campos_nao_encontrados?: string[];
};
