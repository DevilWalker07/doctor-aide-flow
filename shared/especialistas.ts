/**
 * Identidade dos cinco especialistas virtuais.
 *
 * Preservado de `src/lib/specialists/types.ts` (commit 64cbf60). Vive em
 * `shared/` porque servidor e cliente precisam da mesma lista: o servidor para
 * validar qual especialista foi pedido, a tela para mostrar nome e jaleco.
 *
 * Os prompts NÃO estão aqui — ficam em `server/prompts/especialistas.prompt.ts`,
 * fora do bundle do navegador.
 */

export type EspecialistaId = "victor" | "ana" | "cris" | "bruno" | "lucia";

export const ESPECIALISTA_IDS: EspecialistaId[] = ["victor", "ana", "cris", "bruno", "lucia"];

export interface Especialista {
  id: EspecialistaId;
  nome: string;
  titulo: string;
  especialidade: string;
  /** Como ele responde — vira enquadramento no chat. */
  personalidade: string;
  saudacao: string;
  /** As bases que o prompt dele cita. Aparecem na tela e no chat. */
  bases: string[];
  /** Setores em que ele é o primeiro sugerido. Não restringe: o médico escolhe qualquer um. */
  tiposDeEvolucao: string[];
  cor: { jaleco: string; acento: string };
}

export const ESPECIALISTAS: Record<EspecialistaId, Especialista> = {
  victor: {
    id: "victor",
    nome: "Dr. Victor",
    titulo: "Internista",
    especialidade: "Clínica Médica",
    personalidade: "Direto, metódico, foco em diagnóstico diferencial",
    saudacao: "Posso revisar este caso?",
    bases: ["Harrison's", "AMB", "PCDT/MS", "UpToDate"],
    tiposDeEvolucao: ["enfermaria_clinica", "enfermaria_cirurgica"],
    cor: { jaleco: "#1E3A8A", acento: "#2563EB" },
  },
  ana: {
    id: "ana",
    nome: "Dra. Ana",
    titulo: "Intensivista",
    especialidade: "UTI",
    personalidade: "Precisa, baseada em protocolos, foco em estabilidade",
    saudacao: "Vamos revisar a estabilidade do paciente?",
    bases: ["Surviving Sepsis Campaign", "AMIB", "ventilação protetora"],
    tiposDeEvolucao: ["uti", "uti_pediatrica", "uti_neonatal"],
    cor: { jaleco: "#374151", acento: "#6B7280" },
  },
  cris: {
    id: "cris",
    nome: "Dra. Cris",
    titulo: "Pediatra",
    especialidade: "Pediatria",
    personalidade: "Acolhedora, foco em dose/kg e desenvolvimento",
    saudacao: "Vamos cuidar bem da criança?",
    bases: ["SBP", "Nelson 21ª edição"],
    tiposDeEvolucao: ["enfermaria_pediatrica", "upa_pediatrico"],
    cor: { jaleco: "#EC4899", acento: "#F472B6" },
  },
  bruno: {
    id: "bruno",
    nome: "Dr. Bruno",
    titulo: "Emergencista",
    especialidade: "UPA / Emergência",
    personalidade: "Rápido, objetivo, foco em condutas imediatas",
    saudacao: "Precisa de uma segunda opinião rápida?",
    bases: ["ATLS", "ACLS", "Manchester", "ABRAMEDE"],
    tiposDeEvolucao: ["upa"],
    cor: { jaleco: "#059669", acento: "#10B981" },
  },
  lucia: {
    id: "lucia",
    nome: "Dra. Lúcia",
    titulo: "Médica de Família",
    especialidade: "UBS / Ambulatório",
    personalidade: "Longitudinal, foco em prevenção e vínculo",
    saudacao: "Quer uma visão integral do caso?",
    bases: ["Cadernos de Atenção Básica (MS)", "WONCA", "PCDT/MS"],
    tiposDeEvolucao: ["ubs", "ambulatorio"],
    cor: { jaleco: "#FFFFFF", acento: "#A78BFA" },
  },
};

export function getEspecialista(id: string | undefined): Especialista | undefined {
  return id && id in ESPECIALISTAS ? ESPECIALISTAS[id as EspecialistaId] : undefined;
}

/**
 * Quem aparece primeiro num setor. Sugestão, não restrição — todos os cinco
 * continuam disponíveis em qualquer local, porque nenhum mapeamento cobre a
 * dúvida real do plantão (o intensivista com uma pergunta de pediatria).
 */
export function especialistaSugerido(tipoEvolucao?: string | null): Especialista {
  const tipo = (tipoEvolucao ?? "").toLowerCase();
  const achado = ESPECIALISTA_IDS.map((id) => ESPECIALISTAS[id]).find((e) =>
    e.tiposDeEvolucao.some((t) => tipo.includes(t)),
  );
  return achado ?? ESPECIALISTAS.victor;
}
