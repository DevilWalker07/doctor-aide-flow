import {
  Activity,
  Baby,
  Building2,
  HeartPulse,
  Home,
  Siren,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

export interface SubAmbiente {
  id: string;
  label: string;
  descricao: string;
  tipoEvolucao: string;
  icon?: LucideIcon;
}

export interface Ambiente {
  id: string;
  emoji: string;
  label: string;
  curto: string;
  descricao: string;
  icon: LucideIcon;
  accent: { text: string; bg: string; border: string; ring: string };
  subs: SubAmbiente[];
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
      text: "text-rose-300",
      bg: "bg-rose-500/10",
      border: "border-rose-500/30",
      ring: "ring-rose-400/40",
    },
    subs: [
      {
        id: "ps-adulto",
        label: "PS Adulto",
        descricao: "Urgência e emergência do adulto",
        tipoEvolucao: "upa",
      },
      {
        id: "ps-pediatrico",
        label: "PS Pediátrico",
        descricao: "Urgência e emergência pediátrica",
        tipoEvolucao: "upa_pediatrico",
        icon: Baby,
      },
      {
        id: "ps-misto",
        label: "PS Misto / Geral",
        descricao: "Porta única, todas as idades",
        tipoEvolucao: "upa",
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
      text: "text-sky-300",
      bg: "bg-sky-500/10",
      border: "border-sky-500/30",
      ring: "ring-sky-400/40",
    },
    subs: [
      {
        id: "clinica-medica",
        label: "Clínica Médica",
        descricao: "Enfermaria clínica adulta",
        tipoEvolucao: "enfermaria_clinica",
      },
      {
        id: "cirurgica",
        label: "Cirúrgica",
        descricao: "Pré e pós-operatório",
        tipoEvolucao: "enfermaria_cirurgica",
      },
      {
        id: "pediatrica",
        label: "Pediátrica",
        descricao: "Enfermaria pediátrica",
        tipoEvolucao: "enfermaria_pediatrica",
        icon: Baby,
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
      text: "text-violet-300",
      bg: "bg-violet-500/10",
      border: "border-violet-500/30",
      ring: "ring-violet-400/40",
    },
    subs: [
      {
        id: "uti-adulto",
        label: "UTI Adulto",
        descricao: "Terapia intensiva adulta",
        tipoEvolucao: "uti",
      },
      {
        id: "uti-pediatrica",
        label: "UTI Pediátrica",
        descricao: "Terapia intensiva pediátrica",
        tipoEvolucao: "uti_pediatrica",
        icon: Baby,
      },
      {
        id: "uti-neonatal",
        label: "UTI Neonatal",
        descricao: "Cuidado intensivo neonatal",
        tipoEvolucao: "uti_neonatal",
        icon: Baby,
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
      text: "text-emerald-300",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      ring: "ring-emerald-400/40",
    },
    subs: [
      {
        id: "ambulatorio-adulto",
        label: "Ambulatório Adulto",
        descricao: "Especialidades clínicas do adulto",
        tipoEvolucao: "ambulatorio",
      },
      {
        id: "ambulatorio-pediatrico",
        label: "Ambulatório Pediátrico",
        descricao: "Especialidades pediátricas",
        tipoEvolucao: "ambulatorio_pediatrico",
        icon: Baby,
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
      text: "text-amber-300",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      ring: "ring-amber-400/40",
    },
    subs: [
      {
        id: "livre-demanda",
        label: "Consulta Livre Demanda",
        descricao: "Acolhimento e demanda espontânea",
        tipoEvolucao: "ubs",
      },
      {
        id: "pre-natal",
        label: "Pré-Natal de Baixo Risco",
        descricao: "Acompanhamento gestacional",
        tipoEvolucao: "ubs_prenatal",
      },
      {
        id: "cronicos",
        label: "Crônicos (HAS / DM2)",
        descricao: "Hiperdia e metas terapêuticas",
        tipoEvolucao: "ubs_cronicos",
        icon: Activity,
      },
      {
        id: "saude-mental",
        label: "Saúde Mental na ABS",
        descricao: "Acolhimento e seguimento",
        tipoEvolucao: "ubs_saude_mental",
      },
      {
        id: "puericultura",
        label: "Puericultura Pediátrica",
        descricao: "Crescimento e desenvolvimento",
        tipoEvolucao: "ubs_puericultura",
        icon: Baby,
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

export function ambienteLabel(ambienteId: string | undefined, subId: string | undefined): string {
  const a = getAmbiente(ambienteId);
  const s = getSubAmbiente(ambienteId, subId);
  if (!a) return "";
  return s ? `${a.curto} · ${s.label}` : a.label;
}
