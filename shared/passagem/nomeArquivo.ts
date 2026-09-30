import { normalizarDataBR } from "./datas.js";

/**
 * O que dá para tirar do nome do arquivo: leito, nome e data.
 *
 * Não é a fonte da identificação — essa é o cabeçalho do documento, lido pela
 * IA. O nome do arquivo serve de conferência: se o leito do cabeçalho e o do
 * arquivo discordam, o médico é avisado em vez de um dos dois vencer calado.
 * E vira a fonte só quando o documento não tem cabeçalho nenhum.
 *
 * Formatos vistos nos arquivos reais:
 *   L01-_ALOIZIO_VIEIRA_SILVA_18.09.26.docx
 *   L05_-_MISSENO_EDUARDO_18.09.2026.docx
 *   L04 - NARCISO BATISTA CRUZ. 24.04.pdf
 *   L02 - RENATO PEREIRA DE SÁ (24.03).pdf
 */
export interface DoNomeDoArquivo {
  /** `L01`, `ISO 12`… `null` quando o nome não começa por um leito. */
  leito: string | null;
  nome: string | null;
  /** `DD/MM/AAAA` quando o nome traz dia, mês e ano. */
  data: string | null;
}

const LEITO_RE = /^\s*(ISOLAMENTO|ISO|LEITO|L)\s*[-_.]?\s*0*(\d{1,3})(?!\d)/i;
const DATA_RE = /(\d{1,2})[._/-](\d{1,2})(?:[._/-](\d{2}|\d{4}))?(?!\d)/g;

export function lerNomeDoArquivo(nomeArquivo: string): DoNomeDoArquivo {
  const semExtensao = nomeArquivo.replace(/\.[a-z0-9]{2,5}$/i, "");
  const m = semExtensao.match(LEITO_RE);

  let leito: string | null = null;
  let resto = semExtensao;
  if (m) {
    const tipo = m[1].toUpperCase();
    const numero = Number(m[2]);
    leito = tipo.startsWith("ISO") ? `ISO ${numero}` : `L${String(numero).padStart(2, "0")}`;
    resto = semExtensao.slice(m[0].length);
  }

  // A data é o último grupo dd.mm(.aa) do nome.
  let data: string | null = null;
  let posData = -1;
  for (const d of resto.matchAll(DATA_RE)) {
    posData = d.index ?? -1;
    data = d[3] ? normalizarDataBR(`${d[1]}/${d[2]}/${d[3]}`) : null;
  }
  const trechoNome = posData >= 0 ? resto.slice(0, posData) : resto;

  const nome =
    trechoNome
      .replace(/[_]+/g, " ")
      .replace(/[()[\]]/g, " ")
      .replace(/^[\s\-.]+|[\s\-.]+$/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase() || null;

  return { leito, nome, data };
}

/** Número do leito, para comparar `L05`, `LEITO 05`, `05` e `CMM 05` entre si. */
export function numeroDoLeito(leito: string | null | undefined): number | null {
  const m = String(leito ?? "").match(/(\d{1,3})/);
  return m ? Number(m[1]) : null;
}
