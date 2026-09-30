/**
 * Tipos da passagem de plantão, compartilhados entre navegador e servidor.
 *
 * O servidor valida a saída da IA com Zod (`server/schemas/ai.schemas.ts`) e o
 * resultado tem esta forma. O navegador junta os leitos e gera o DOCX a partir
 * dela. Manter os tipos aqui, e não no schema, é o que deixa o gerador de DOCX
 * rodar no navegador sem importar código de servidor.
 */

export type Prioridade = "!! URGENTE" | "! HOJE" | "PENDÊNCIA SOCIAL" | "PALIATIVO";

/** Uma linha do mapa: um leito. */
export interface LinhaMapa {
  leito: string;
  paciente: string;
  dih: string;
  di: number | null;
  diagnostico: string;
  quadroAtual: string;
  atb: string;
  ultimoLab: string;
  condutasHoje: string;
  alertasPendencias: string;
  dispositivos: string | null;
  anotacoesVisita: string;
  resumoLinha: string;
  sugestoesClinicas: string[];
  /**
   * O texto deste leito veio de foto, print ou PDF escaneado. Número lido de
   * imagem atravessa schema e guardrails sem ser notado quando está errado na
   * origem — a marca no DOCX é o que resta para alguém conferir.
   */
  lidoDeImagem?: boolean;
}

export interface AlertaCritico {
  prioridade: Prioridade;
  leito: string | null;
  paciente: string;
  acao: string;
}

export interface MapaPlantaoData {
  pacientes: LinhaMapa[];
  alertasCriticos: AlertaCritico[];
}

/** Uma prioridade do plantão que recebe, como no modelo: uma frase por paciente. */
export interface PrioridadePlantao {
  prioridade: Prioridade;
  leito: string;
  paciente: string;
  texto: string;
}

/** As cinco categorias de PENDÊNCIAS GERAIS do modelo do hospital. */
export const CATEGORIAS_PENDENCIA = [
  "admissoesPendentes",
  "labsAIncorporar",
  "procedimentosAgendados",
  "altasEmProgramacao",
  "avisosCriticos",
] as const;
export type CategoriaPendencia = (typeof CATEGORIAS_PENDENCIA)[number];

export const TITULO_CATEGORIA: Record<CategoriaPendencia, string> = {
  admissoesPendentes: "ADMISSÕES COM DADO PENDENTE",
  labsAIncorporar: "LABS RECENTES A INCORPORAR",
  procedimentosAgendados: "PROCEDIMENTOS AGENDADOS",
  altasEmProgramacao: "ALTAS EM PROGRAMAÇÃO",
  avisosCriticos: "AVISOS CRÍTICOS",
};

/**
 * Listas que precisam enxergar o plantão inteiro. Saem de uma chamada final
 * sobre as linhas já validadas — nunca sobre o texto das evoluções.
 */
export interface Consolidacao {
  prioridades: PrioridadePlantao[];
  pendencias: Record<CategoriaPendencia, string[]>;
}

export interface CabecalhoMapa {
  hospital?: string;
  /** "diurno" ou "noturno". */
  periodo?: string;
  /** Data do plantão que recebe. */
  passagemPara?: string;
}
