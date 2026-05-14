export type Evolution = {
  id: string;
  patientId: string;
  shiftId?: string | null;
  date?: string;
  text: string;
  generatedBy?: string;
  createdAt: string;
};

export type EvolutionReview = {
  campos_faltantes: string[];
  inconsistencias: string[];
  alertas: string[];
  sugestoes: string[];
};
