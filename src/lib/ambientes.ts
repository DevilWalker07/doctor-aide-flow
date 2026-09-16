import {
  Activity,
  Baby,
  Building2,
  ClipboardList,
  FileText,
  HeartPulse,
  Home,
  MessageSquareText,
  Pill,
  Scissors,
  Siren,
  Stethoscope,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Atalho para uma tela que já existe. */
export interface Atalho {
  label: string;
  descricao: string;
  to: string;
  icon: LucideIcon;
}

/** Famílias de atendimento — definem só o acento visual. */
export type Familia = "emergencia" | "enfermaria" | "uti" | "ambulatorio" | "atencao-primaria";

/**
 * Local de atendimento.
 *
 * Era uma árvore de dois níveis (ambiente → subambiente). Virou lista plana
 * porque é assim que o médico pensa quando abre o app: ele não escolhe uma
 * categoria e depois uma subcategoria, ele já sabe onde está.
 */
export interface Local {
  id: string;
  label: string;
  descricao: string;
  familia: Familia;
  icon: LucideIcon;
  /** Define o template de evolução e os agentes do plantão. */
  tipoEvolucao: string;
  /**
   * Existe template de evolução para este local?
   * Quando false, a interface mostra "Em breve" ANTES do toque — o médico não
   * descobre que não dá só depois de clicar.
   */
  implementado: boolean;
  /** Telas prontas que fazem sentido a partir deste local. */
  atalhos: Atalho[];
}

/** Acentos válidos nos dois temas: só borda e ícone recebem cor. */
export const ACENTOS: Record<Familia, { text: string; bg: string; border: string; ring: string }> =
  {
    emergencia: {
      text: "text-rose-600 dark:text-rose-300",
      bg: "bg-rose-500/10",
      border: "border-rose-500/40 dark:border-rose-500/30",
      ring: "ring-rose-500/50",
    },
    enfermaria: {
      text: "text-sky-700 dark:text-sky-300",
      bg: "bg-sky-500/10",
      border: "border-sky-500/40 dark:border-sky-500/30",
      ring: "ring-sky-500/50",
    },
    uti: {
      text: "text-violet-700 dark:text-violet-300",
      bg: "bg-violet-500/10",
      border: "border-violet-500/40 dark:border-violet-500/30",
      ring: "ring-violet-500/50",
    },
    ambulatorio: {
      text: "text-emerald-700 dark:text-emerald-300",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/40 dark:border-emerald-500/30",
      ring: "ring-emerald-500/50",
    },
    "atencao-primaria": {
      text: "text-amber-700 dark:text-amber-300",
      bg: "bg-amber-500/10",
      border: "border-amber-500/40 dark:border-amber-500/30",
      ring: "ring-amber-500/50",
    },
  };

const ATALHO_RECEITA: Atalho = {
  label: "Receituário",
  descricao: "Receita ilustrada, em linguagem simples",
  to: "/prescricao-alta",
  icon: Pill,
};
const ATALHO_COPILOTO: Atalho = {
  label: "Copiloto clínico",
  descricao: "Dose, diluição e conduta em segundos",
  to: "/copiloto",
  icon: MessageSquareText,
};
const ATALHO_EXAMES: Atalho = {
  label: "Resumo de exames",
  descricao: "Cole o laudo e receba os valores organizados",
  to: "/resumo-exames",
  icon: FileText,
};
const ATALHO_PASSAGEM: Atalho = {
  label: "Passagem de plantão",
  descricao: "Mapa do setor em DOCX a partir das evoluções",
  to: "/passagem-plantao",
  icon: ClipboardList,
};
const ATALHO_ROUND: Atalho = {
  label: "Round do setor",
  descricao: "Visão dos leitos e pendências do dia",
  to: "/round",
  icon: Users,
};
const ATALHO_ENCAMINHAMENTO: Atalho = {
  label: "Encaminhamento",
  descricao: "Carta de referência para a especialidade",
  to: "/encaminhamento",
  icon: FileText,
};
const ATALHO_ORIENTACOES: Atalho = {
  label: "Orientações ao paciente",
  descricao: "Instruções ilustradas para entregar na consulta",
  to: "/orientacoes-paciente",
  icon: ClipboardList,
};

/**
 * Os dez locais de atendimento, na ordem em que aparecem na tela inicial.
 *
 * Fonte única: telas, formulários e seeds leem daqui. Dois locais podem
 * compartilhar `tipoEvolucao` — o que muda é o setor gravado no plantão, que
 * aparece na passagem.
 */
export const LOCAIS: Local[] = [
  {
    id: "ubs",
    label: "UBS",
    descricao: "Atenção primária, crônicos, pré-natal e puericultura",
    familia: "atencao-primaria",
    icon: Home,
    tipoEvolucao: "ubs",
    implementado: true,
    atalhos: [ATALHO_RECEITA, ATALHO_ORIENTACOES, ATALHO_ENCAMINHAMENTO],
  },
  {
    id: "ps-adulto",
    label: "PS Adulto",
    descricao: "Urgência e emergência do adulto",
    familia: "emergencia",
    icon: Siren,
    tipoEvolucao: "upa",
    implementado: true,
    atalhos: [ATALHO_COPILOTO, ATALHO_EXAMES, ATALHO_RECEITA],
  },
  {
    id: "ps-pediatrico",
    label: "PS Pediátrico",
    descricao: "Urgência e emergência pediátrica",
    familia: "emergencia",
    icon: Baby,
    tipoEvolucao: "upa_pediatrico",
    implementado: false,
    atalhos: [ATALHO_COPILOTO, ATALHO_EXAMES, ATALHO_RECEITA],
  },
  {
    id: "enfermaria-adulto",
    label: "Enfermaria Adulto",
    descricao: "Internamento geral de adultos",
    familia: "enfermaria",
    icon: Building2,
    tipoEvolucao: "enfermaria_clinica",
    implementado: true,
    atalhos: [ATALHO_PASSAGEM, ATALHO_ROUND, ATALHO_RECEITA],
  },
  {
    id: "enfermaria-clinica",
    label: "Enfermaria Clínica",
    descricao: "Round e evoluções diárias da clínica médica",
    familia: "enfermaria",
    icon: Stethoscope,
    tipoEvolucao: "enfermaria_clinica",
    implementado: true,
    atalhos: [ATALHO_PASSAGEM, ATALHO_ROUND, ATALHO_RECEITA],
  },
  {
    id: "enfermaria-cirurgica",
    label: "Enfermaria Cirúrgica",
    descricao: "Pré e pós-operatório",
    familia: "enfermaria",
    icon: Scissors,
    tipoEvolucao: "enfermaria_cirurgica",
    implementado: false,
    atalhos: [ATALHO_PASSAGEM, ATALHO_ROUND, ATALHO_RECEITA],
  },
  {
    id: "ambulatorio-especialidade",
    label: "Ambulatório de Especialidade",
    descricao: "Consultas eletivas, retornos e encaminhamentos",
    familia: "ambulatorio",
    icon: Activity,
    tipoEvolucao: "ambulatorio",
    implementado: false,
    atalhos: [ATALHO_RECEITA, ATALHO_ENCAMINHAMENTO, ATALHO_ORIENTACOES],
  },
  {
    id: "uti-adulto",
    label: "UTI Adulto",
    descricao: "Suporte avançado, DVA, ventilação e dispositivos",
    familia: "uti",
    icon: HeartPulse,
    tipoEvolucao: "uti",
    implementado: true,
    atalhos: [ATALHO_PASSAGEM, ATALHO_COPILOTO, ATALHO_EXAMES],
  },
  {
    id: "uti-pediatrica",
    label: "UTI Pediátrica",
    descricao: "Terapia intensiva pediátrica",
    familia: "uti",
    icon: Baby,
    tipoEvolucao: "uti_pediatrica",
    implementado: false,
    atalhos: [ATALHO_PASSAGEM, ATALHO_COPILOTO, ATALHO_EXAMES],
  },
  {
    id: "uti-neonatal",
    label: "UTI Neonatal",
    descricao: "Cuidado intensivo neonatal",
    familia: "uti",
    icon: Baby,
    tipoEvolucao: "uti_neonatal",
    implementado: false,
    atalhos: [ATALHO_PASSAGEM, ATALHO_COPILOTO, ATALHO_EXAMES],
  },
];

/** Atalhos que valem em qualquer lugar, inclusive sem plantão. */
export const ATALHOS_GLOBAIS: Atalho[] = [ATALHO_RECEITA, ATALHO_COPILOTO, ATALHO_EXAMES];

export function getLocal(id: string | undefined): Local | undefined {
  return LOCAIS.find((l) => l.id === id);
}

export function acentoDo(local: Local) {
  return ACENTOS[local.familia];
}

export function localLabel(id: string | undefined): string {
  return getLocal(id)?.label ?? "";
}

/** Tipos de evolução distintos, para a tela de seleção de setor. */
export function tiposDeEvolucaoDisponiveis(): Local[] {
  const vistos = new Set<string>();
  return LOCAIS.filter((l) => {
    if (!l.implementado || vistos.has(l.tipoEvolucao)) return false;
    vistos.add(l.tipoEvolucao);
    return true;
  });
}
