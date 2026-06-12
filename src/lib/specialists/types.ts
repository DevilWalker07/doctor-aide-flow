/**
 * Tipos do sistema de Especialistas Virtuais.
 *
 * Cada setor do hospital tem um especialista virtual com identidade,
 * personalidade e prompt próprios. O médico pode pedir parecer
 * consultivo — nunca alteração automática.
 */

export type SpecialistId = "victor" | "ana" | "cris" | "bruno" | "lucia";

export type UnitType =
  | "enfermaria_clinica"
  | "uti"
  | "enfermaria_pediatrica"
  | "upa"
  | "ubs";

export interface Specialist {
  id: SpecialistId;
  nome: string;
  titulo: string;
  especialidade: string;
  personalidade: string;
  saudacao: string;
  unitTypes: UnitType[];
  cor: {
    jaleco: string;
    acento: string;
    bg: string;
    text: string;
  };
}

export const SPECIALISTS: Record<SpecialistId, Specialist> = {
  victor: {
    id: "victor",
    nome: "Dr. Victor",
    titulo: "Internista",
    especialidade: "Clínica Médica",
    personalidade: "Direto, metódico, foco em diagnóstico diferencial",
    saudacao: "Posso revisar este caso?",
    unitTypes: ["enfermaria_clinica"],
    cor: { jaleco: "#1E3A8A", acento: "#2563EB", bg: "bg-blue-600", text: "text-white" },
  },
  ana: {
    id: "ana",
    nome: "Dra. Ana",
    titulo: "Intensivista",
    especialidade: "UTI",
    personalidade: "Precisa, baseada em protocolos, foco em estabilidade",
    saudacao: "Vamos revisar a estabilidade do paciente?",
    unitTypes: ["uti"],
    cor: { jaleco: "#374151", acento: "#6B7280", bg: "bg-slate-700", text: "text-white" },
  },
  cris: {
    id: "cris",
    nome: "Dra. Cris",
    titulo: "Pediatra",
    especialidade: "Pediatria",
    personalidade: "Acolhedora, foco em dose/kg e desenvolvimento",
    saudacao: "Vamos cuidar bem da criança?",
    unitTypes: ["enfermaria_pediatrica"],
    cor: { jaleco: "#EC4899", acento: "#F472B6", bg: "bg-pink-500", text: "text-white" },
  },
  bruno: {
    id: "bruno",
    nome: "Dr. Bruno",
    titulo: "Emergencista",
    especialidade: "UPA / Emergência",
    personalidade: "Rápido, objetivo, foco em condutas imediatas",
    saudacao: "Precisa de uma segunda opinião rápida?",
    unitTypes: ["upa"],
    cor: { jaleco: "#059669", acento: "#10B981", bg: "bg-emerald-600", text: "text-white" },
  },
  lucia: {
    id: "lucia",
    nome: "Dra. Lúcia",
    titulo: "Médica de Família",
    especialidade: "UBS / Ambulatório",
    personalidade: "Longitudinal, foco em prevenção e vínculo",
    saudacao: "Quer uma visão integral do caso?",
    unitTypes: ["ubs"],
    cor: { jaleco: "#FFFFFF", acento: "#A78BFA", bg: "bg-violet-500", text: "text-white" },
  },
};

export function specialistForUnit(unit?: string | null): Specialist {
  const u = (unit || "").toLowerCase();
  if (u.includes("uti")) return SPECIALISTS.ana;
  if (u.includes("pedi")) return SPECIALISTS.cris;
  if (u.includes("upa") || u.includes("emerg")) return SPECIALISTS.bruno;
  if (u.includes("ubs") || u.includes("ambul")) return SPECIALISTS.lucia;
  return SPECIALISTS.victor; // default clínica médica
}

export type SuggestionPriority = "alta" | "media" | "baixa";

export interface ConsultSuggestion {
  id: string;
  text: string;
  priority: SuggestionPriority;
}

export interface ConsultSection {
  title: string;
  content: string;
  alert?: boolean;
}

export interface ConsultResponse {
  specialist: string;
  specialist_id?: SpecialistId;
  generated_at: string;
  sections: ConsultSection[];
  suggestions: ConsultSuggestion[];
  references: string[];
}

export interface SavedConsult extends ConsultResponse {
  id: string;
  patient_id: string;
  accepted_suggestion_ids: string[];
}

export interface ConsultRequestPayload {
  specialist_id: SpecialistId;
  clinical_context: string;
  unit_type: UnitType;
}
