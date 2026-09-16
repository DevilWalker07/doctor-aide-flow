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
  Siren,
  Stethoscope,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Atalho para uma tela que já existe, oferecido dentro de um ambiente. */
export interface AtalhoAmbiente {
  label: string;
  descricao: string;
  to: string;
  icon: LucideIcon;
}

export interface SubAmbiente {
  id: string;
  label: string;
  descricao: string;
  tipoEvolucao: string;
  icon?: LucideIcon;
  /**
   * Existe template de evolução e fluxo de plantão para este subambiente?
   * Quando false, a interface mostra "Em breve" ANTES do toque — o médico
   * não descobre que não dá depois de clicar.
   */
  implementado: boolean;
}

export interface Ambiente {
  id: string;
  emoji: string;
  label: string;
  curto: string;
  descricao: string;
  icon: LucideIcon;
  /** Classes utilitárias de acento, válidas nos dois temas. */
  accent: { text: string; bg: string; border: string; ring: string };
  subs: SubAmbiente[];
  /** Telas prontas que fazem sentido a partir deste ambiente. */
  atalhos: AtalhoAmbiente[];
}

export const AMBIENTES: Ambiente[] = [
  {
    id: "pronto-socorro",
    emoji: "🚨",
    label: "Pronto-Socorro / Emergência",
    curto: "Emergência",
    descricao: "Atendimento de urgência, triagem e observação.",
    icon: Siren,
    accent: {
      text: "text-rose-600 dark:text-rose-300",
      bg: "bg-rose-500/10",
      border: "border-rose-500/40 dark:border-rose-500/30",
      ring: "ring-rose-500/50",
    },
    subs: [
      {
        id: "ps-adulto",
        label: "PS Adulto",
        descricao: "Urgência e emergência do adulto",
        tipoEvolucao: "upa",
        implementado: true,
      },
      {
        id: "ps-pediatrico",
        label: "PS Pediátrico",
        descricao: "Urgência e emergência pediátrica",
        tipoEvolucao: "upa_pediatrico",
        implementado: false,
        icon: Baby,
      },
      {
        id: "ps-misto",
        label: "PS Misto / Geral",
        descricao: "Porta única, todas as idades",
        tipoEvolucao: "upa",
        implementado: true,
      },
    ],
    atalhos: [
      {
        label: "Copiloto clínico",
        descricao: "Dose, diluição e conduta em segundos",
        to: "/copiloto",
        icon: MessageSquareText,
      },
      {
        label: "Resumo de exames",
        descricao: "Cole o laudo e receba os valores organizados",
        to: "/resumo-exames",
        icon: FileText,
      },
      {
        label: "Receituário de alta",
        descricao: "Receita ilustrada para levar para casa",
        to: "/prescricao-alta",
        icon: Pill,
      },
    ],
  },
  {
    id: "enfermaria",
    emoji: "🏥",
    label: "Enfermaria de Internamento",
    curto: "Enfermaria",
    descricao: "Round, evoluções diárias e passagem de plantão.",
    icon: Building2,
    accent: {
      text: "text-sky-700 dark:text-sky-300",
      bg: "bg-sky-500/10",
      border: "border-sky-500/40 dark:border-sky-500/30",
      ring: "ring-sky-500/50",
    },
    subs: [
      {
        id: "clinica-medica",
        label: "Clínica Médica",
        descricao: "Enfermaria clínica adulta",
        tipoEvolucao: "enfermaria_clinica",
        implementado: true,
      },
      {
        id: "cirurgica",
        label: "Cirúrgica",
        descricao: "Pré e pós-operatório",
        tipoEvolucao: "enfermaria_cirurgica",
        implementado: false,
      },
      {
        id: "pediatrica",
        label: "Pediátrica",
        descricao: "Enfermaria pediátrica",
        tipoEvolucao: "enfermaria_pediatrica",
        implementado: true,
        icon: Baby,
      },
    ],
    atalhos: [
      {
        label: "Passagem de plantão",
        descricao: "Mapa do setor em DOCX a partir das evoluções",
        to: "/passagem-plantao",
        icon: ClipboardList,
      },
      {
        label: "Round do setor",
        descricao: "Visão dos leitos e pendências do dia",
        to: "/round",
        icon: Users,
      },
      {
        label: "Receituário de alta",
        descricao: "Receita ilustrada para levar para casa",
        to: "/prescricao-alta",
        icon: Pill,
      },
    ],
  },
  {
    id: "uti",
    emoji: "🫀",
    label: "Unidade de Terapia Intensiva",
    curto: "UTI",
    descricao: "Suporte avançado, DVA, ventilação e dispositivos.",
    icon: HeartPulse,
    accent: {
      text: "text-violet-700 dark:text-violet-300",
      bg: "bg-violet-500/10",
      border: "border-violet-500/40 dark:border-violet-500/30",
      ring: "ring-violet-500/50",
    },
    subs: [
      {
        id: "uti-adulto",
        label: "UTI Adulto",
        descricao: "Terapia intensiva adulta",
        tipoEvolucao: "uti",
        implementado: true,
      },
      {
        id: "uti-pediatrica",
        label: "UTI Pediátrica",
        descricao: "Terapia intensiva pediátrica",
        tipoEvolucao: "uti_pediatrica",
        implementado: false,
        icon: Baby,
      },
      {
        id: "uti-neonatal",
        label: "UTI Neonatal",
        descricao: "Cuidado intensivo neonatal",
        tipoEvolucao: "uti_neonatal",
        implementado: false,
        icon: Baby,
      },
    ],
    atalhos: [
      {
        label: "Passagem de plantão",
        descricao: "Mapa do setor em DOCX a partir das evoluções",
        to: "/passagem-plantao",
        icon: ClipboardList,
      },
      {
        label: "Copiloto clínico",
        descricao: "Dose, diluição e conduta em segundos",
        to: "/copiloto",
        icon: MessageSquareText,
      },
      {
        label: "Resumo de exames",
        descricao: "Cole o laudo e receba os valores organizados",
        to: "/resumo-exames",
        icon: FileText,
      },
    ],
  },
  {
    id: "ambulatorio",
    emoji: "🩺",
    label: "Ambulatório de Especialidades",
    curto: "Ambulatório",
    descricao: "Consultas eletivas, retornos e encaminhamentos.",
    icon: Stethoscope,
    accent: {
      text: "text-emerald-700 dark:text-emerald-300",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/40 dark:border-emerald-500/30",
      ring: "ring-emerald-500/50",
    },
    subs: [
      {
        id: "ambulatorio-adulto",
        label: "Ambulatório Adulto",
        descricao: "Especialidades clínicas do adulto",
        tipoEvolucao: "ambulatorio",
        implementado: false,
      },
      {
        id: "ambulatorio-pediatrico",
        label: "Ambulatório Pediátrico",
        descricao: "Especialidades pediátricas",
        tipoEvolucao: "ambulatorio_pediatrico",
        implementado: false,
        icon: Baby,
      },
    ],
    atalhos: [
      {
        label: "Receituário",
        descricao: "Receita ilustrada com posologia em linguagem simples",
        to: "/prescricao-alta",
        icon: Pill,
      },
      {
        label: "Encaminhamento",
        descricao: "Carta de referência para a especialidade",
        to: "/encaminhamento",
        icon: FileText,
      },
      {
        label: "Orientações ao paciente",
        descricao: "Instruções ilustradas para entregar na consulta",
        to: "/orientacoes-paciente",
        icon: ClipboardList,
      },
    ],
  },
  {
    id: "ubs",
    emoji: "🏡",
    label: "Unidade Básica de Saúde",
    curto: "ABS / UBS / ESF",
    descricao: "Atenção primária, crônicos, pré-natal e puericultura.",
    icon: Home,
    accent: {
      text: "text-amber-700 dark:text-amber-300",
      bg: "bg-amber-500/10",
      border: "border-amber-500/40 dark:border-amber-500/30",
      ring: "ring-amber-500/50",
    },
    subs: [
      {
        id: "livre-demanda",
        label: "Consulta Livre Demanda",
        descricao: "Acolhimento e demanda espontânea",
        tipoEvolucao: "ubs",
        implementado: true,
      },
      {
        id: "pre-natal",
        label: "Pré-Natal de Baixo Risco",
        descricao: "Acompanhamento gestacional",
        tipoEvolucao: "ubs_prenatal",
        implementado: false,
      },
      {
        id: "cronicos",
        label: "Crônicos (HAS / DM2)",
        descricao: "Hiperdia e metas terapêuticas",
        tipoEvolucao: "ubs_cronicos",
        implementado: false,
        icon: Activity,
      },
      {
        id: "saude-mental",
        label: "Saúde Mental na ABS",
        descricao: "Acolhimento e seguimento",
        tipoEvolucao: "ubs_saude_mental",
        implementado: false,
      },
      {
        id: "puericultura",
        label: "Puericultura Pediátrica",
        descricao: "Crescimento e desenvolvimento",
        tipoEvolucao: "ubs_puericultura",
        implementado: false,
        icon: Baby,
      },
    ],
    atalhos: [
      {
        label: "Receituário",
        descricao: "Receita ilustrada com posologia em linguagem simples",
        to: "/prescricao-alta",
        icon: Pill,
      },
      {
        label: "Orientações ao paciente",
        descricao: "Instruções ilustradas para entregar na consulta",
        to: "/orientacoes-paciente",
        icon: ClipboardList,
      },
      {
        label: "Encaminhamento",
        descricao: "Carta de referência para a especialidade",
        to: "/encaminhamento",
        icon: FileText,
      },
    ],
  },
];

export function getAmbiente(id: string | undefined): Ambiente | undefined {
  return AMBIENTES.find((a) => a.id === id);
}

export function getSubAmbiente(
  ambienteId: string | undefined,
  subId: string | undefined,
): SubAmbiente | undefined {
  return getAmbiente(ambienteId)?.subs.find((s) => s.id === subId);
}

/** Atalhos que valem em qualquer lugar do app, inclusive quando não há plantão. */
export const ATALHOS_GLOBAIS: AtalhoAmbiente[] = [
  {
    label: "Receituário de alta",
    descricao: "Receita ilustrada, com posologia em linguagem simples",
    to: "/prescricao-alta",
    icon: Pill,
  },
  {
    label: "Copiloto clínico",
    descricao: "Dose, diluição e conduta em segundos",
    to: "/copiloto",
    icon: MessageSquareText,
  },
  {
    label: "Resumo de exames",
    descricao: "Cole o laudo e receba os valores organizados",
    to: "/resumo-exames",
    icon: FileText,
  },
];

export function ambienteLabel(ambienteId: string | undefined, subId: string | undefined): string {
  const a = getAmbiente(ambienteId);
  const s = getSubAmbiente(ambienteId, subId);
  if (!a) return "";
  return s ? `${a.curto} · ${s.label}` : a.label;
}
