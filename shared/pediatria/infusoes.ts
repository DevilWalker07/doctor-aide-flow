/**
 * Infusões contínuas (aba "Infusões contínuas" da planilha; doses habituais do
 * UpToDate, 09/05/2021). Cada droga tem a apresentação em <unidade-base>/mL e a
 * unidade da dose; a conta é sempre a mesma:
 *
 *   volume de droga = dose × peso × k × volume total ÷ (apresentação × vazão)
 *
 * com k = 60 para dose por minuto e 1 para dose por hora.
 */
import { formatarMl, formatarNumero } from "./calculos.js";

export type UnidadeInfusao = "mcg/kg/min" | "mcg/kg/h" | "mg/kg/h" | "UI/kg/h";

export interface DrogaInfusao {
  id: string;
  nome: string;
  unidade: UnidadeInfusao;
  faixa: [number, number];
  /** Concentração da apresentação na unidade-base da dose (mcg, mg ou UI) por mL. */
  apresentacao: number;
  /** Rótulo humano da apresentação. */
  apresentacaoTexto: string;
  /** Diluição padrão do serviço, quando existe (mL de droga em mL totais). */
  padrao?: { drogaMl: number; totalMl: number };
  notas?: string[];
}

export const DROGAS_INFUSAO: DrogaInfusao[] = [
  {
    id: "adrenalina",
    nome: "Adrenalina",
    unidade: "mcg/kg/min",
    faixa: [0.05, 1],
    apresentacao: 1000,
    apresentacaoTexto: "1 mg/mL",
  },
  {
    id: "atracurio",
    nome: "Atracúrio",
    unidade: "mcg/kg/min",
    faixa: [5, 28],
    apresentacao: 10000,
    apresentacaoTexto: "10 mg/mL",
  },
  {
    id: "cetamina",
    nome: "Cetamina",
    unidade: "mcg/kg/min",
    faixa: [5, 66],
    apresentacao: 50000,
    apresentacaoTexto: "50 mg/mL",
    notas: [
      "Sedação em crianças: 5 a 20 mcg/kg/min.",
      "Status epilepticus refratário: estudos em adultos usam até 4 mg/kg/h (66,7 mcg/kg/min).",
    ],
  },
  {
    id: "cisatracurio",
    nome: "Cisatracúrio",
    unidade: "mcg/kg/min",
    faixa: [1, 4],
    apresentacao: 2000,
    apresentacaoTexto: "2 mg/mL",
    notas: ["A planilha traz 1 a 4 mcg/kg/h; a dose de manutenção usual é 1 a 4 mcg/kg/min."],
  },
  {
    id: "dexmedetomidina",
    nome: "Dexmedetomidina",
    unidade: "mcg/kg/h",
    faixa: [0.05, 2],
    apresentacao: 100,
    apresentacaoTexto: "100 mcg/mL (200 mcg/2 mL)",
    padrao: { drogaMl: 2, totalMl: 50 },
    notas: [
      "Diluição padrão: 2 mL + 48 mL de diluente = 4 mcg/mL. Ajuste a vazão até a dose habitual.",
      "Confira a apresentação: a planilha registra 200 mcg/mL, mas a diluição padrão (4 mcg/mL) pressupõe 100 mcg/mL.",
    ],
  },
  {
    id: "dobutamina",
    nome: "Dobutamina",
    unidade: "mcg/kg/min",
    faixa: [2.5, 20],
    apresentacao: 12500,
    apresentacaoTexto: "250 mg/20 mL (12,5 mg/mL)",
  },
  {
    id: "fentanil",
    nome: "Fentanil",
    unidade: "mcg/kg/h",
    faixa: [1, 5],
    apresentacao: 50,
    apresentacaoTexto: "50 mcg/mL",
    notas: ["Adulto em ventilação mecânica na UTI: habitualmente 50 a 200 mcg/h."],
  },
  {
    id: "midazolam",
    nome: "Midazolam",
    unidade: "mg/kg/h",
    faixa: [0.1, 0.4],
    apresentacao: 5,
    apresentacaoTexto: "5 mg/mL",
    notas: [
      "Pode chegar a 2 mg/kg/h em status epilepticus refratário.",
      "Adulto em ventilação mecânica na UTI: habitualmente 1 a 8 mg/h.",
    ],
  },
  {
    id: "milrinona",
    nome: "Milrinona",
    unidade: "mcg/kg/min",
    faixa: [0.25, 0.75],
    apresentacao: 1000,
    apresentacaoTexto: "1 mg/mL",
  },
  {
    id: "noradrenalina",
    nome: "Noradrenalina",
    unidade: "mcg/kg/min",
    faixa: [0.05, 2],
    apresentacao: 1000,
    apresentacaoTexto: "1 mg/mL",
  },
  {
    id: "pancuronio",
    nome: "Pancurônio",
    unidade: "mcg/kg/min",
    faixa: [0.8, 1.3],
    apresentacao: 2000,
    apresentacaoTexto: "2 mg/mL",
  },
  {
    id: "rocuronio",
    nome: "Rocurônio",
    unidade: "mcg/kg/min",
    faixa: [8, 12],
    apresentacao: 10000,
    apresentacaoTexto: "10 mg/mL",
  },
  {
    id: "vasopressina",
    nome: "Vasopressina",
    unidade: "UI/kg/h",
    faixa: [0.01, 0.48],
    apresentacao: 20,
    apresentacaoTexto: "20 UI/mL",
  },
];

export const porMinuto = (u: UnidadeInfusao) => u.endsWith("/min");
const fatorTempo = (u: UnidadeInfusao) => (porMinuto(u) ? 60 : 1);
/** Unidade-base da dose ("mcg", "mg", "UI"). */
export const unidadeBase = (u: UnidadeInfusao) => u.split("/")[0];

/** Quantidade de droga por hora (na unidade-base). */
export const quantidadePorHora = (dose: number, peso: number, u: UnidadeInfusao) =>
  dose * peso * fatorTempo(u);

export interface Seringa {
  drogaMl: number;
  diluenteMl: number;
  totalMl: number;
  /** Concentração final, unidade-base/mL. */
  concentracao: number;
  /** Volume de droga não cabe na seringa: vazão baixa demais para essa dose. */
  invalida: boolean;
}

/** Monta a seringa para que `vazao` mL/h entregue `dose`. */
export function montarSeringa(
  droga: Pick<DrogaInfusao, "unidade">,
  apresentacao: number,
  dose: number,
  peso: number,
  vazao: number,
  totalMl: number,
): Seringa {
  const porHora = quantidadePorHora(dose, peso, droga.unidade);
  const concentracao = vazao > 0 ? porHora / vazao : 0;
  const drogaMl = apresentacao > 0 ? (concentracao * totalMl) / apresentacao : 0;
  return {
    drogaMl,
    diluenteMl: Math.max(0, totalMl - drogaMl),
    totalMl,
    concentracao,
    invalida: !(drogaMl > 0) || drogaMl > totalMl,
  };
}

/** Seringa já preparada (ex.: diluição padrão): concentração fixa. */
export function seringaPreparada(apresentacao: number, drogaMl: number, totalMl: number): Seringa {
  const concentracao = (apresentacao * drogaMl) / totalMl;
  return {
    drogaMl,
    diluenteMl: totalMl - drogaMl,
    totalMl,
    concentracao,
    invalida: drogaMl <= 0 || drogaMl > totalMl,
  };
}

/** Vazão (mL/h) que entrega `dose` com a concentração dada. */
export const vazaoParaDose = (
  dose: number,
  peso: number,
  u: UnidadeInfusao,
  concentracao: number,
) => (concentracao > 0 ? quantidadePorHora(dose, peso, u) / concentracao : 0);

/** Dose entregue por `vazao` mL/h com a concentração dada. */
export const doseParaVazao = (
  vazao: number,
  peso: number,
  u: UnidadeInfusao,
  concentracao: number,
) => (peso > 0 ? (vazao * concentracao) / (peso * fatorTempo(u)) : 0);

export type Diluente = "SF 0,9%" | "SG 5%";

export function textoPrescricao(p: {
  droga: DrogaInfusao;
  apresentacaoTexto: string;
  seringa: Seringa;
  vazao: number;
  dose: number;
  diluente: Diluente;
}): string {
  const { droga, seringa } = p;
  return (
    `${droga.nome} (${p.apresentacaoTexto}) ${formatarMl(seringa.drogaMl)} mL + ` +
    `${p.diluente} ${formatarMl(seringa.diluenteMl)} mL (total ${formatarMl(seringa.totalMl)} mL; ` +
    `${formatarNumero(seringa.concentracao)} ${unidadeBase(droga.unidade)}/mL). ` +
    `Infundir em bomba a ${formatarNumero(p.vazao, 1)} mL/h = ${formatarNumero(p.dose)} ${droga.unidade}.`
  );
}
