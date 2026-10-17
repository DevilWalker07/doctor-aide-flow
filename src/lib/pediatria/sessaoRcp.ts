/**
 * Sessão de RCP: tudo o que precisa sobreviver a um recarregamento da página
 * ou ao celular travar no meio da parada. O relógio é guardado como horário
 * absoluto (Date.now()), então o cronômetro continua certo ao retomar.
 *
 * Fica no próprio aparelho (localStorage, chave `da_rcp_sessao` via
 * `storage`) e nunca vai ao servidor.
 */
import type { Paciente } from "@/components/pediatria/Identificacao";
import type { Relacao, Ritmo } from "../../../shared/pediatria/pcr";
import { storage } from "@/lib/storage";

export interface Evento {
  /** ms desde o início da RCP */
  t: number;
  texto: string;
}

export interface Equipe {
  lider: string;
  compressorA: string;
  compressorB: string;
  viaAerea: string;
  medicacao: string;
  anotador: string;
}

export const EQUIPE_VAZIA: Equipe = {
  lider: "",
  compressorA: "",
  compressorB: "",
  viaAerea: "",
  medicacao: "",
  anotador: "",
};

export const PAPEIS: { id: keyof Equipe; rotulo: string }[] = [
  { id: "lider", rotulo: "Líder" },
  { id: "compressorA", rotulo: "Compressor 1" },
  { id: "compressorB", rotulo: "Compressor 2" },
  { id: "viaAerea", rotulo: "Via aérea" },
  { id: "medicacao", rotulo: "Medicação" },
  { id: "anotador", rotulo: "Anotador" },
];

export type FaseRcp = "rcp" | "checagem" | "choque" | "fim";

export interface SessaoRcp {
  versao: 1;
  inicio: number;
  cicloInicio: number;
  /** Ciclos de 2 min já completados (cada troca de compressor soma um). */
  ciclo: number;
  fase: FaseRcp;
  fim: { em: number; resultado: "rce" | "encerrada" } | null;
  relacao: Relacao;
  eventos: Evento[];
  choques: number;
  adrenalinas: number;
  ultimaAdrenalina: number | null;
  amiodaronas: number;
  ritmo: Ritmo | null;
  causas: string[];
  /** Quantas vezes cada droga das gavetas foi registrada. */
  registros: Record<string, number>;
  cvPasso: number;
  equipe: Equipe;
  paciente: Paciente | null;
}

export function novaSessao(agora: number, paciente: Paciente | null): SessaoRcp {
  return {
    versao: 1,
    inicio: agora,
    cicloInicio: agora,
    ciclo: 0,
    fase: "rcp",
    fim: null,
    relacao: "15:2",
    eventos: [{ t: 0, texto: "RCP iniciada" }],
    choques: 0,
    adrenalinas: 0,
    ultimaAdrenalina: null,
    amiodaronas: 0,
    ritmo: null,
    causas: [],
    registros: {},
    cvPasso: 0,
    equipe: { ...EQUIPE_VAZIA },
    paciente,
  };
}

/** Acrescenta um evento com o tempo decorrido desde o início. */
export function comEvento(s: SessaoRcp, agora: number, texto: string): SessaoRcp {
  return { ...s, eventos: [...s.eventos, { t: Math.max(0, agora - s.inicio), texto }] };
}

/** Quem está comprimindo neste ciclo (alterna a cada 2 min). */
export function compressorDaVez(s: Pick<SessaoRcp, "ciclo" | "equipe">): string | null {
  const nome = s.ciclo % 2 === 0 ? s.equipe.compressorA : s.equipe.compressorB;
  return nome.trim() || null;
}

/** Sessão guardada há mais que isso é descartada: não é mais a mesma parada. */
export const VALIDADE_MS = 12 * 60 * 60_000;

function valida(x: unknown): x is SessaoRcp {
  if (!x || typeof x !== "object") return false;
  const s = x as Partial<SessaoRcp>;
  return (
    s.versao === 1 &&
    typeof s.inicio === "number" &&
    typeof s.cicloInicio === "number" &&
    Array.isArray(s.eventos) &&
    typeof s.fase === "string"
  );
}

export function salvarSessao(s: SessaoRcp): void {
  try {
    storage.setRcpSessao(JSON.stringify(s));
  } catch {
    // armazenamento cheio ou bloqueado: a RCP segue, só não sobrevive a recarregar
  }
}

export function carregarSessao(agora: number): SessaoRcp | null {
  try {
    const raw = storage.getRcpSessao();
    if (!raw) return null;
    const s: unknown = JSON.parse(raw);
    if (!valida(s)) return null;
    if (agora - s.inicio > VALIDADE_MS) return null;
    return completarSessao(s);
  } catch {
    return null;
  }
}

/** Sessões antigas podem não ter campos novos: completa com os padrões. */
function completarSessao(s: SessaoRcp): SessaoRcp {
  return {
    ...novaSessao(s.inicio, s.paciente ?? null),
    ...s,
    equipe: { ...EQUIPE_VAZIA, ...(s.equipe ?? {}) },
  };
}

export function apagarSessao(): void {
  try {
    storage.clearRcpSessao();
  } catch {
    /* nada a fazer */
  }
}
