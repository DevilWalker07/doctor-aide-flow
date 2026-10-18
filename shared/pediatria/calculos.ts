/**
 * Motor de cálculo da emergência pediátrica. TypeScript puro: a tela nunca
 * calcula nada por conta própria. Precisão total por dentro; arredondamento só
 * em `formatarMl`/`formatarNumero`, na exibição.
 */
import type { DrogaBolus } from "./drogas.js";

export const PESO_MIN = 0.5;
export const PESO_MAX = 80;
/** Acima disso o peso ainda é aceito, mas a tela pede confirmação. */
export const PESO_CONFIRMAR = 40;

export interface Idade {
  anos: number;
  meses: number;
  dias: number;
}

export const idadeEmMeses = (i: Idade): number => i.anos * 12 + i.meses + i.dias / 30.4375;
export const idadeEmAnos = (i: Idade): number => idadeEmMeses(i) / 12;

export function idadeInformada(i: Idade | null): i is Idade {
  return i !== null && (i.anos > 0 || i.meses > 0 || i.dias > 0);
}

export function descreverIdade(i: Idade): string {
  const partes: string[] = [];
  if (i.anos) partes.push(`${i.anos} ${i.anos === 1 ? "ano" : "anos"}`);
  if (i.meses) partes.push(`${i.meses} ${i.meses === 1 ? "mês" : "meses"}`);
  if (i.dias) partes.push(`${i.dias} ${i.dias === 1 ? "dia" : "dias"}`);
  return partes.length ? partes.join(" e ") : "recém-nascido";
}

export function pesoValido(peso: number): boolean {
  return Number.isFinite(peso) && peso >= PESO_MIN && peso <= PESO_MAX;
}

export type Sexo = "M" | "F";

/**
 * Peso estimado pela idade.
 * - Até 12 meses: (meses + 9) ÷ 2 — é o que a planilha reproduz (10,5 kg aos
 *   12 meses).
 * - De 1 a 12 anos, com sexo informado: meninos 2 × idade + 9, meninas
 *   2 × idade + 8.
 * - De 1 a 12 anos, sem sexo: 2 × idade + 8 até 6 anos e (7 × idade − 5) ÷ 2
 *   de 7 a 12.
 * Acima de 12 anos não estima: pesar.
 */
export function pesoEstimado(i: Idade, sexo: Sexo | null = null): number | null {
  const meses = idadeEmMeses(i);
  if (meses <= 12) return (Math.floor(meses) + 9) / 2;
  const anos = Math.floor(meses / 12);
  if (anos > 12) return null;
  if (sexo === "M") return 2 * anos + 9;
  if (sexo === "F") return 2 * anos + 8;
  if (anos <= 6) return 2 * anos + 8;
  return (7 * anos - 5) / 2;
}

/**
 * Peso que destoa mais de 30% do estimado para a idade pede confirmação —
 * 25 kg num lactente de 1 ano é quase sempre erro de digitação.
 */
export function pesoDestoaDaIdade(
  peso: number,
  i: Idade | null,
  sexo: Sexo | null = null,
): boolean {
  if (!idadeInformada(i)) return false;
  const est = pesoEstimado(i, sexo);
  if (est === null) return false;
  return Math.abs(peso - est) / est > 0.3;
}

/** Superfície corporal. Sem altura: (4P + 7) ÷ (P + 90), como a planilha. Com altura: Mosteller. */
export function superficieCorporal(peso: number, alturaCm?: number | null): number {
  if (alturaCm && alturaCm > 0) return Math.sqrt((alturaCm * peso) / 3600);
  return (4 * peso + 7) / (peso + 90);
}

export interface ResultadoBolus {
  /** Dose total na unidade da droga, já limitada pelo teto. */
  dose: number;
  /** Dose calculada antes do teto. */
  doseCalculada: number;
  /** Fator de diluição (1 = sem diluir; 1:9 → 10). */
  fator: number;
  /** Concentração da solução preparada. */
  concentracaoFinal: number;
  /** mL a aspirar da solução preparada (com teto). */
  volumeMl: number;
  volumeCalculadoMl: number;
  /** Quanto da apresentação pura entra no preparo: 1 mL + 9 mL AD, etc. */
  preparo: { drogaMl: number; diluenteMl: number } | null;
  atingiuTeto: boolean;
  /** Seringa sugerida para aspirar o volume. */
  seringaMl: number;
}

const SERINGAS = [1, 3, 5, 10, 20, 60];

export function seringaPara(volumeMl: number): number {
  return SERINGAS.find((s) => volumeMl <= s) ?? 60;
}

export function calcularBolus(droga: DrogaBolus, peso: number): ResultadoBolus {
  const fator = 1 + droga.diluicao;
  const doseCalculada = droga.dosePorKg * peso;
  const concentracaoFinal = droga.concentracao / fator;
  const volumeCalculadoMl = doseCalculada / concentracaoFinal;
  const atingiuTeto = droga.maxMl !== null && volumeCalculadoMl >= droga.maxMl;
  const volumeMl = atingiuTeto && droga.maxMl !== null ? droga.maxMl : volumeCalculadoMl;
  const dose = volumeMl * concentracaoFinal;
  return {
    dose,
    doseCalculada,
    fator,
    concentracaoFinal,
    volumeMl,
    volumeCalculadoMl,
    preparo: droga.diluicao > 0 ? { drogaMl: 1, diluenteMl: droga.diluicao } : null,
    atingiuTeto,
    seringaMl: seringaPara(volumeMl),
  };
}

/** Cargas de choque (bifásico), em J/kg, na ordem em que são aplicadas. */
export const CARGAS_CARDIOVERSAO = [0.5, 1, 2];
export const CARGAS_DESFIBRILACAO = [2, 4, 6, 8, 10];
/** Teto padrão: carga máxima usual de desfibrilador bifásico adulto. */
export const ENERGIA_MAXIMA_PADRAO = 200;

export interface ResultadoChoque {
  jPorKg: number;
  /** Joules, arredondados para baixo (o seletor do aparelho é inteiro) e com teto. */
  joules: number;
  atingiuTeto: boolean;
}

export function energiaChoque(
  jPorKg: number,
  peso: number,
  teto: number = ENERGIA_MAXIMA_PADRAO,
): ResultadoChoque {
  const bruto = jPorKg * peso;
  const atingiuTeto = bruto >= teto;
  const joules = atingiuTeto ? teto : Math.max(1, Math.floor(bruto));
  return { jPorKg, joules, atingiuTeto };
}

/**
 * Energia do n-ésimo choque na PCR (PALS): 2 J/kg, depois 4 J/kg, depois
 * escalona até 10 J/kg — nunca acima do teto do aparelho.
 */
export function energiaDesfibrilacaoN(n: number, peso: number, teto?: number): ResultadoChoque {
  const idx = Math.min(Math.max(n, 1), CARGAS_DESFIBRILACAO.length) - 1;
  return energiaChoque(CARGAS_DESFIBRILACAO.at(idx) ?? 10, peso, teto);
}

// ---------------------------------------------------------------- formatação

const nf = (casas: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casas });

/** Até 2 casas abaixo de 10 mL (seringas de 1–5 mL têm marca de 0,01–0,1), 1 casa até 100, inteiro acima. */
export function formatarMl(ml: number): string {
  if (ml < 10) return nf(2).format(ml);
  if (ml < 100) return nf(1).format(ml);
  return nf(0).format(ml);
}

export function formatarNumero(n: number, casas = 2): string {
  if (n !== 0 && Math.abs(n) < 0.1) return nf(3).format(n);
  return nf(casas).format(n);
}
