import { idadeEmAnos, idadeEmMeses, type Idade } from "./calculos.js";

export interface ViaAerea {
  /** Diâmetro interno, mm. */
  tuboComCuff: number;
  tuboSemCuff: number;
  /** Profundidade no lábio, cm (3 × diâmetro do tubo com cuff). */
  profundidadeCm: number;
  lamina: { numero: string; tipo: "Reta" | "Reta ou curva" };
  /** Neonato: tubo e profundidade dependem do peso e da IG — a fórmula não serve. */
  avisoNeonato: boolean;
}

const meioAbaixo = (mm: number) => Math.floor(mm * 2) / 2;

/**
 * PALS: com cuff = idade/4 + 3,5 e sem cuff = idade/4 + 4 a partir dos 2 anos;
 * abaixo disso, valores fixos por faixa. Arredondado para o 0,5 mm abaixo.
 */
export function viaAerea(i: Idade): ViaAerea {
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
  let lamina: ViaAerea["lamina"];
  if (meses < 1) lamina = { numero: "0", tipo: "Reta" };
  else if (meses < 12) lamina = { numero: "1", tipo: "Reta" };
  else if (anos < 2) lamina = { numero: "1", tipo: "Reta" };
  else if (anos < 8) lamina = { numero: "2", tipo: "Reta ou curva" };
  else lamina = { numero: "2–3", tipo: "Reta ou curva" };

  return {
    tuboComCuff: comCuff,
    tuboSemCuff: semCuff,
    profundidadeCm: Math.round(comCuff * 3 * 2) / 2,
    lamina,
    avisoNeonato: meses < 1,
  };
}
