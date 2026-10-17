/**
 * Agrupamentos das drogas da ficha para as ações do modo RCP. As doses vêm
 * de `DROGAS_BOLUS` (planilha); o que não está na planilha fica em
 * `DROGAS_EXTRAS`, com a fonte ao lado.
 */
import { DROGAS_BOLUS, type DrogaBolus } from "./drogas.js";

/**
 * Sulfato de magnésio — não está na planilha. PALS 2020: torsades de pointes,
 * 25 a 50 mg/kg IV/IO, máximo 2 g. Apresentação 50% (500 mg/mL): 2 g = 4 mL.
 */
export const MAGNESIO: DrogaBolus = {
  id: "magnesio",
  nome: "Sulfato de magnésio 50%",
  sinonimos: ["magnesio", "torsades"],
  via: "IV/IO",
  grupo: "arritmia",
  concentracao: 500,
  unidade: "mg",
  dosePorKg: 50,
  diluente: null,
  diluicao: 0,
  maxMl: 4,
  nota: "Torsades de pointes (PALS: 25–50 mg/kg, máx. 2 g). Diluir em SF antes de infundir.",
};

export const DROGAS_EXTRAS: DrogaBolus[] = [MAGNESIO];

const porId = (id: string): DrogaBolus => {
  const d = [...DROGAS_BOLUS, ...DROGAS_EXTRAS].find((x) => x.id === id);
  if (!d) throw new Error(`Droga desconhecida: ${id}`);
  return d;
};

export interface ItemKit {
  droga: DrogaBolus;
  /** Para que serve aqui — uma linha. */
  papel: string;
}

const kit = (itens: [string, string][]): ItemKit[] =>
  itens.map(([id, papel]) => ({ droga: porId(id), papel }));

/** Sequência rápida de intubação: pré-medicação, indução, bloqueio. */
export const KIT_INTUBACAO: ItemKit[] = kit([
  ["atropina", "Opcional: bradicardia ou lactente"],
  ["fentanil", "Analgesia"],
  ["cetamina-iv", "Indução — preferida no choque"],
  ["midazolam-iv", "Indução — alternativa"],
  ["propofol", "Indução — evite na instabilidade"],
  ["rocuronio", "Bloqueio neuromuscular"],
  ["cisatracurio", "Bloqueio — alternativa"],
]);

export const KIT_SEDOANALGESIA: ItemKit[] = kit([
  ["fentanil", "Analgesia"],
  ["morfina", "Analgesia"],
  ["cetamina-iv", "Sedação dissociativa"],
  ["cetamina-im", "Sem acesso venoso"],
  ["midazolam-iv", "Sedação"],
  ["midazolam-in", "Sem acesso / convulsão"],
  ["propofol", "Sedação profunda"],
]);

/** Para a cardioversão sincronizada de paciente consciente. */
export const KIT_CARDIOVERSAO: ItemKit[] = kit([
  ["adenosina-1", "TSV estável: tente antes do choque"],
  ["adenosina-2", "TSV: se a 1ª falhar"],
  ["cetamina-iv", "Sedação para o choque"],
  ["midazolam-iv", "Sedação para o choque"],
  ["fentanil", "Analgesia"],
]);

export const KIT_OUTRAS: ItemKit[] = kit([
  ["lidocaina", "FV/TVSP: alternativa à amiodarona"],
  ["magnesio", "Torsades de pointes"],
  ["bicarbonato", "Hipercalemia, intoxicação por tricíclico"],
  ["gluconato-calcio", "Hipercalemia, hipocalcemia, hipermagnesemia"],
  ["glicose-25", "Hipoglicemia"],
  ["naloxona", "Intoxicação por opioide"],
  ["adrenalina-et", "Sem acesso IV/IO"],
]);
