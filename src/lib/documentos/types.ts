import type { Acao, Horario } from "@/lib/medical/medicamentos";
import type { EncaminhamentoForm } from "@/lib/medical/encaminhamentoTemplates";

export interface PacienteDocumento {
  pacienteId?: string | null;
  nome: string;
  idade?: string;
  sexo?: "M" | "F" | "";
  documento?: string;
  leito?: string;
}

export interface MedicoDocumento {
  nome: string;
  crm: string;
  especialidade: string;
  hospital: string;
}

export interface ReceitaItem {
  id: string;
  medicamentoId: string | null;
  nome: string;
  apresentacao: string;
  dose: string;
  quantidade: string;
  horarios: Partial<Record<Horario, number>>;
  instrucao: string;
  duracao: string;
  observacao: string;
  acao: Acao;
  farmaciaPopular: boolean;
  controlado: "C1" | "B1" | null;
}

export interface ReceitaDocumento {
  paciente: PacienteDocumento;
  itens: ReceitaItem[];
  observacoes: string;
  vias: 1 | 2;
  data: string;
}

export interface EncaminhamentoDocumento {
  paciente: PacienteDocumento;
  form: EncaminhamentoForm;
  texto: string;
  data: string;
}

export interface OrientacoesDocumento {
  paciente: PacienteDocumento;
  orientacaoIds: string[];
  extras: string[];
  retorno: string;
  data: string;
}

export type OutpatientDocument =
  | { type: "receita"; title: string; patientId: string | null; content: ReceitaDocumento }
  | {
      type: "encaminhamento";
      title: string;
      patientId: string | null;
      content: EncaminhamentoDocumento;
    }
  | { type: "orientacoes"; title: string; patientId: string | null; content: OrientacoesDocumento };

export interface StoredOutpatientDocument {
  id: string;
  type: OutpatientDocument["type"];
  title: string;
  patient_id: string | null;
  content: OutpatientDocument["content"];
  created_at: string;
  origem: "supabase" | "local";
}
