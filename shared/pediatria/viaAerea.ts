import { idadeEmAnos, idadeEmMeses, type Idade } from "./calculos.js";

export type TipoLamina = "reta" | "curva";

export interface ViaAerea {
  /** Diâmetro interno, mm. PALS 2020: prefira o tubo com cuff. */
  tuboComCuff: number;
  tuboSemCuff: number;
  /** Profundidade no lábio, cm (3 × diâmetro do tubo com cuff). */
  profundidadeCm: number;
  /** Lâmina reta (Miller), número. */
  laminaReta: string;
  /** Lâmina curva (Macintosh), número — null quando a reta é a indicada. */
  laminaCurva: string | null;
  /** Qual usar primeiro: reta abaixo de 2 anos; acima, as duas servem. */
  laminaIndicada: TipoLamina | "ambas";
  /** Resumo antigo, mantido para quem já usa. */
  lamina: { numero: string; tipo: "Reta" | "Reta ou curva" };
  /** Sonda de aspiração traqueal, French: 2 × diâmetro do tubo. */
  aspiracaoFr: number;
  /** Máscara laríngea (dispositivo supraglótico), tamanho pelo peso. */
  mascaraLaringea: string | null;
  /** De onde saiu a estimativa. */
  fonte: "idade" | "peso";
  /** Neonato: tubo e profundidade dependem do peso e da IG — a fórmula não serve. */
  avisoNeonato: boolean;
}

const meioAbaixo = (mm: number) => Math.floor(mm * 2) / 2;
const profundidade = (cuff: number) => Math.round(cuff * 3 * 2) / 2;
const aspiracao = (semCuff: number) => Math.round(semCuff * 2);

/** Máscara laríngea pelo peso (tamanhos usuais do dispositivo). */
export function mascaraLaringea(peso: number | null): string | null {
  if (!peso || peso <= 0) return null;
  if (peso < 5) return "1";
  if (peso < 10) return "1,5";
  if (peso < 20) return "2";
  if (peso < 30) return "2,5";
  if (peso < 50) return "3";
  if (peso < 70) return "4";
  return "5";
}

function laminas(
  reta: string,
  curva: string | null,
): Pick<ViaAerea, "laminaReta" | "laminaCurva" | "laminaIndicada" | "lamina"> {
  return {
    laminaReta: reta,
    laminaCurva: curva,
    laminaIndicada: curva ? "ambas" : "reta",
    lamina: { numero: curva ? `${reta}–${curva}` : reta, tipo: curva ? "Reta ou curva" : "Reta" },
  };
}

/**
 * Pela idade (PALS): com cuff = idade/4 + 3,5 e sem cuff = idade/4 + 4 a
 * partir dos 2 anos; abaixo disso, valores fixos por faixa. Arredondado para o
 * 0,5 mm abaixo. Lâmina reta até 2 anos (epiglote longa e mole do lactente);
 * depois, reta ou curva.
 */
export function viaAerea(i: Idade, peso: number | null = null): ViaAerea {
  const anos = idadeEmAnos(i);
  const meses = idadeEmMeses(i);
  let comCuff: number;
  let semCuff: number;
  if (meses < 12) {
    comCuff = 3;
    semCuff = 3.5;
  } else if (anos < 2) {
    comCuff = 3.5;
    semCuff = 4;
  } else {
    const a = Math.floor(anos);
    comCuff = meioAbaixo(a / 4 + 3.5);
    semCuff = meioAbaixo(a / 4 + 4);
  }
  const l =
    meses < 1
      ? laminas("0", null)
      : anos < 2
        ? laminas("1", null)
        : anos < 8
          ? laminas("2", "2")
          : laminas("2", "3");

  return {
    tuboComCuff: comCuff,
    tuboSemCuff: semCuff,
    profundidadeCm: profundidade(comCuff),
    ...l,
    aspiracaoFr: aspiracao(semCuff),
    mascaraLaringea: mascaraLaringea(peso),
    fonte: "idade",
    avisoNeonato: meses < 1,
  };
}

/**
 * Sem idade: pela faixa de peso das zonas da fita de ressuscitação baseada no
 * comprimento (PALS). É aproximação — com a idade, a fórmula manda.
 */
const FAIXAS: { ate: number; cuff: number; semCuff: number; reta: string; curva: string | null }[] =
  [
    { ate: 6, cuff: 3, semCuff: 3.5, reta: "1", curva: null },
    { ate: 10, cuff: 3, semCuff: 3.5, reta: "1", curva: null },
    { ate: 12, cuff: 3.5, semCuff: 4, reta: "1", curva: null },
    { ate: 15, cuff: 4, semCuff: 4.5, reta: "2", curva: null },
    { ate: 19, cuff: 4.5, semCuff: 5, reta: "2", curva: null },
    { ate: 24, cuff: 5, semCuff: 5.5, reta: "2", curva: "2" },
    { ate: 30, cuff: 5.5, semCuff: 6, reta: "2", curva: "2" },
    { ate: 37, cuff: 6, semCuff: 6.5, reta: "2", curva: "3" },
    { ate: Infinity, cuff: 6.5, semCuff: 7, reta: "3", curva: "3" },
  ];

export function viaAereaPorPeso(peso: number): ViaAerea {
  const f = FAIXAS.find((x) => peso < x.ate) ?? FAIXAS[FAIXAS.length - 1];
  return {
    tuboComCuff: f.cuff,
    tuboSemCuff: f.semCuff,
    profundidadeCm: profundidade(f.cuff),
    ...laminas(f.reta, f.curva),
    aspiracaoFr: aspiracao(f.semCuff),
    mascaraLaringea: mascaraLaringea(peso),
    fonte: "peso",
    avisoNeonato: peso < 3,
  };
}

/** A melhor estimativa disponível: idade quando há, senão peso. */
export function viaAereaPaciente(idade: Idade | null, peso: number | null): ViaAerea | null {
  if (idade) return viaAerea(idade, peso);
  if (peso) return viaAereaPorPeso(peso);
  return null;
}
