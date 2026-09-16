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

/** Finalidades previstas de atestado. */
export type FinalidadeAtestado =
  | "afastamento"
  | "comparecimento"
  | "acompanhante"
  | "atividade-fisica";

export interface AtestadoDocumento {
  paciente: PacienteDocumento;
  finalidade: FinalidadeAtestado;
  /** Dias de afastamento (só para finalidade "afastamento"). */
  dias: string;
  /** Início do afastamento ou dia do comparecimento, em dd/MM/yyyy. */
  dataInicio: string;
  /** Horário de comparecimento, quando aplicável. */
  horaInicio: string;
  horaFim: string;
  /** Nome do paciente acompanhado, para finalidade "acompanhante". */
  acompanhado: string;
  cid: string;
  /**
   * O CID só entra no documento com autorização expressa do paciente
   * (Código de Ética Médica, art. 73 e Resolução CFM 1.851/2008).
   * Sem isto marcado, `cid` é ignorado na impressão.
   */
  cidAutorizado: boolean;
  observacoes: string;
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
  | { type: "orientacoes"; title: string; patientId: string | null; content: OrientacoesDocumento }
  | { type: "atestado"; title: string; patientId: string | null; content: AtestadoDocumento };

export interface StoredOutpatientDocument {
  id: string;
  type: OutpatientDocument["type"];
  title: string;
  patient_id: string | null;
  content: OutpatientDocument["content"];
  created_at: string;
  origem: "supabase" | "local";
}
