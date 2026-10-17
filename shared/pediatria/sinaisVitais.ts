import { idadeEmAnos, idadeEmMeses, type Idade } from "./calculos.js";

export type Faixa = [number, number];

export interface SinaisVitais {
  faixaEtaria: string;
  fc: Faixa;
  fr: Faixa;
  pas: Faixa;
  pad: Faixa;
  pam: Faixa;
}

/**
 * Valores normais (FC acordado, FR, PA) das tabelas do PALS 2020 — a faixa de
 * 1 a 2 anos é a mesma da planilha (FC 98–140, FR 22–37, PAS 86–106…).
 */
const TABELA: (SinaisVitais & { ateMeses: number })[] = [
  {
    ateMeses: 1,
    faixaEtaria: "Neonato",
    fc: [100, 205],
    fr: [30, 53],
    pas: [67, 84],
    pad: [35, 53],
    pam: [45, 60],
  },
  {
    ateMeses: 12,
    faixaEtaria: "Lactente",
    fc: [100, 180],
    fr: [30, 53],
    pas: [72, 104],
    pad: [37, 56],
    pam: [50, 62],
  },
  {
    ateMeses: 36,
    faixaEtaria: "1 a 2 anos",
    fc: [98, 140],
    fr: [22, 37],
    pas: [86, 106],
    pad: [42, 63],
    pam: [49, 62],
  },
  {
    ateMeses: 72,
    faixaEtaria: "Pré-escolar",
    fc: [80, 120],
    fr: [20, 28],
    pas: [89, 112],
    pad: [46, 72],
    pam: [58, 69],
  },
  {
    ateMeses: 120,
    faixaEtaria: "Escolar",
    fc: [75, 118],
    fr: [18, 25],
    pas: [97, 115],
    pad: [57, 76],
    pam: [66, 72],
  },
  {
    ateMeses: 156,
    faixaEtaria: "Pré-adolescente",
    fc: [75, 118],
    fr: [18, 25],
    pas: [102, 120],
    pad: [61, 80],
    pam: [71, 79],
  },
  {
    ateMeses: Infinity,
    faixaEtaria: "Adolescente",
    fc: [60, 100],
    fr: [12, 20],
    pas: [110, 131],
    pad: [64, 83],
    pam: [73, 84],
  },
];

export function sinaisVitais(i: Idade): SinaisVitais {
  const meses = idadeEmMeses(i);
  const linha = TABELA.find((l) => meses < l.ateMeses) ?? TABELA[TABELA.length - 1];
  return {
    faixaEtaria: linha.faixaEtaria,
    fc: linha.fc,
    fr: linha.fr,
    pas: linha.pas,
    pad: linha.pad,
    pam: linha.pam,
  };
}

/** PAS mínima aceitável (hipotensão) — PALS: 70 + 2 × idade entre 1 e 10 anos. */
export function pasMinima(i: Idade): number {
  const meses = idadeEmMeses(i);
  if (meses < 1) return 60;
  if (meses < 12) return 70;
  const anos = Math.floor(idadeEmAnos(i));
  if (anos <= 10) return 70 + 2 * anos;
  return 90;
}
