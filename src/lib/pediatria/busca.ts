/**
 * Busca única da emergência pediátrica: drogas (com nome comercial), infusões,
 * condutas dos Hs e Ts e as seções da ficha. Cada palavra digitada tem de
 * casar com o começo de alguma palavra do item: "roc" acha rocurônio, mas
 * "ronio" não — sílabas soltas no meio da palavra trariam resultado demais.
 */
import { CAUSAS } from "../../../shared/pediatria/causas";
import { DROGAS_BOLUS } from "../../../shared/pediatria/drogas";
import { DROGAS_INFUSAO } from "../../../shared/pediatria/infusoes";
import { DROGAS_EXTRAS } from "../../../shared/pediatria/kits";
import type { AbaPed } from "./pacienteSalvo";

export type Resultado =
  | { tipo: "droga"; id: string; titulo: string; sub: string }
  | { tipo: "infusao"; id: string; titulo: string; sub: string }
  | { tipo: "causa"; id: string; titulo: string; sub: string }
  | { tipo: "secao"; aba: AbaPed; titulo: string; sub: string }
  | { tipo: "rcp"; titulo: string; sub: string };

export const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const palavras = (s: string) =>
  normalizar(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

interface Entrada {
  r: Resultado;
  nome: string;
  chaves: string[];
}

const PALAVRAS_CAUSA: Record<string, string[]> = {
  hipovolemia: ["volume", "desidratacao", "hemorragia", "sangramento", "bolus", "soro"],
  hipoxia: ["oxigenio", "dope", "ventilacao"],
  acidose: ["bicarbonato", "ph"],
  hipoglicemia: ["glicemia", "glicose", "dextro"],
  potassio: ["potassio", "hipercalemia", "hipocalemia", "calemia"],
  hipotermia: ["frio", "afogamento", "temperatura"],
  pneumotorax: ["descompressao", "toracocentese", "agulha", "dreno"],
  tamponamento: ["pericardiocentese", "derrame", "pericardio"],
  toxinas: ["intoxicacao", "antidoto", "envenenamento", "overdose", "opioide", "veneno"],
  tep: ["embolia", "tep", "trombolise"],
  coronaria: ["infarto", "kawasaki", "iam"],
};

function montarIndice(): Entrada[] {
  const e: Entrada[] = [];
  e.push({
    r: { tipo: "rcp", titulo: "Iniciar RCP", sub: "Metrônomo, cronômetro e algoritmo PALS" },
    nome: "Iniciar RCP",
    chaves: ["rcp", "pcr", "parada", "reanimacao", "metronomo", "compressao", "massagem"],
  });
  for (const d of [...DROGAS_BOLUS, ...DROGAS_EXTRAS]) {
    e.push({
      r: { tipo: "droga", id: d.id, titulo: d.nome, sub: d.via },
      nome: d.nome,
      chaves: [d.via, ...d.sinonimos],
    });
  }
  for (const d of DROGAS_INFUSAO) {
    e.push({
      r: {
        tipo: "infusao",
        id: d.id,
        titulo: `${d.nome} em infusão`,
        sub: `${d.faixa.join("–")} ${d.unidade}`,
      },
      nome: d.nome,
      chaves: ["infusao", "bomba", "continua", "drogas vasoativas"],
    });
  }
  for (const c of CAUSAS) {
    e.push({
      r: { tipo: "causa", id: c.id, titulo: c.nome, sub: "Conduta (Hs e Ts)" },
      nome: c.nome,
      chaves: PALAVRAS_CAUSA[c.id] ?? [],
    });
  }
  e.push({
    r: { tipo: "secao", aba: "iot", titulo: "Intubação", sub: "Tubo, lâmina, sequência rápida" },
    nome: "Intubação",
    chaves: [
      "intubar",
      "iot",
      "tubo",
      "cuff",
      "lamina",
      "laringoscopio",
      "miller",
      "macintosh",
      "mascara laringea",
      "aspiracao",
      "via aerea",
      "sequencia rapida",
      "sri",
    ],
  });
  e.push({
    r: {
      tipo: "secao",
      aba: "choque",
      titulo: "Choque e sinais vitais",
      sub: "Desfibrilação, cardioversão, FC, FR, PA",
    },
    nome: "Choque",
    chaves: [
      "desfibrilacao",
      "desfibrilar",
      "cardioversao",
      "joules",
      "sinais vitais",
      "fc",
      "fr",
      "pa",
      "pressao",
      "frequencia",
      "superficie corporal",
      "hipotensao",
    ],
  });
  e.push({
    r: {
      tipo: "secao",
      aba: "infusoes",
      titulo: "Infusões contínuas",
      sub: "Dose e vazão em bomba",
    },
    nome: "Infusões",
    chaves: ["bomba", "vazao", "drogas vasoativas", "prescricao"],
  });
  return e;
}

const INDICE = montarIndice();

/** Busca; vazio para consulta vazia. Nome antes de palavra-chave; no máximo `limite`. */
export function buscar(consulta: string, limite = 12): Resultado[] {
  const termos = palavras(consulta);
  if (termos.length === 0) return [];
  const pontuados: { r: Resultado; pontos: number }[] = [];
  for (const it of INDICE) {
    const doNome = palavras(it.nome);
    const todas = [...doNome, ...it.chaves.flatMap(palavras)];
    const casa = termos.every((t) => todas.some((p) => p.startsWith(t)));
    if (!casa) continue;
    const noNome = termos.every((t) => doNome.some((p) => p.startsWith(t)));
    const inicio = normalizar(it.nome).startsWith(termos.join(" "));
    pontuados.push({ r: it.r, pontos: (inicio ? 2 : 0) + (noNome ? 1 : 0) });
  }
  return pontuados
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, limite)
    .map((x) => x.r);
}
