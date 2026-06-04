import type { ProtocolDefinition } from "../types";

/**
 * Cálculo do bolus de SF 3%:
 *
 * - Adulto típico: 2 mL/kg, máximo 100 mL por bolus, infusão em 10-20 min.
 * - SF 3% = 30 g/L NaCl = 513 mEq/L.
 *
 * Pra PREPARAR 250 mL de SF 3% a partir de NaCl 20% + SF 0,9%:
 *   - NaCl 20% = 200 mg/mL = 3,42 mEq/mL
 *   - SF 0,9%  =   9 mg/mL = 0,154 mEq/mL
 *
 * Pra 250 mL com [Na] final ≈ 513 mEq/L precisamos de:
 *   Na total alvo = 0,513 × 250 = 128,25 mEq
 *
 * Sistema (V_nacl + V_sf = 250) e (3,42·V_nacl + 0,154·V_sf = 128,25)
 *   → V_nacl ≈ 28,5 mL e V_sf ≈ 221,5 mL.
 *
 * Pra simplificar no leito, a aproximação tradicional usada em UTI/CTI BR é:
 *   55 mL NaCl 20% + 445 mL SF 0,9% → 500 mL SF ≈ 3,0%
 * Mantemos essa fórmula clássica abaixo.
 */
function calcularSF3(volumeMl: number): { nacl20: number; sf09: number } {
  // Razão clássica: 11% NaCl 20% + 89% SF 0,9%
  const nacl20 = Math.round(volumeMl * 0.11);
  const sf09 = volumeMl - nacl20;
  return { nacl20, sf09 };
}

export const HIPONATREMIA_GRAVE: ProtocolDefinition = {
  id: "hiponatremia_grave",
  title: "Hiponatremia grave",
  severity: "critico",

  trigger: (ctx) => {
    const na = ctx.labs?.sodio;
    if (na == null || Number.isNaN(na)) return { matched: false };
    if (na < 125) return { matched: true, evidence: `Na ${na} mEq/L` };
    return { matched: false };
  },

  problem_entry: (ctx) =>
    `HIPONATREMIA GRAVE (NA ${ctx.labs?.sodio} MEQ/L) — A/E: SIADH? HIPOVOLEMIA? INSUFICIÊNCIA ADRENAL? HIPOTIROIDISMO?`,

  summary:
    "Na <125 mEq/L. Risco de edema cerebral, convulsão, herniação. Correção controlada para evitar mielinólise pontina central.",

  protocol_text: `HIPONATREMIA GRAVE (Na <125 mEq/L)

FISIOPATOLOGIA:
Excesso de água livre relativo ao sódio. Causa mais comum em internados: SIADH
(medicamentos, neoplasias, doenças pulmonares). Outras causas: hipovolemia
(perda renal/extrarrenal), hipervolemia (IC, cirrose, sd. nefrótica), insuf.
adrenal, hipotireoidismo grave, polidipsia, potomania.

AVALIAÇÃO INICIAL:
- Volemia clínica: PA, FC, mucosas, edema, turgor
- Sintomas neurológicos: rebaixamento, convulsão, cefaleia, náusea
- Osmolaridade sérica e urinária; Na urinário
- TSH, cortisol matinal

TRATAMENTO:

1. SINTOMÁTICO GRAVE (rebaixamento, convulsão, coma):
   SF 3% — 100 mL EV em BOLUS 10 min.
   Repetir até 3x se não houver melhora neurológica.
   Meta nas primeiras 1-2h: ↑ 4-6 mEq/L.

2. ASSINTOMÁTICO ou OLIGOSSINTOMÁTICO com Na <125:
   SF 3% em infusão contínua, ajustar pelo Na seriado de 4/4h.
   Meta nas 24h: ↑ 8-12 mEq/L (NÃO MAIS).

3. SE HIPOVOLEMIA: SF 0,9% + tratar causa.
   SE SIADH: restrição hídrica 800-1000 mL/dia ± SF 3% ± tolvaptan.
   SE HIPERVOLEMIA (IC/cirrose): diurético de alça + restrição hídrica.

RISCOS:
⚠ MIELINÓLISE PONTINA CENTRAL se corrigir >8-12 mEq/L em 24h ou
  >18 mEq/L em 48h. Em crônica/idoso/desnutrido/etilista, ainda mais conservador.

REAVALIAÇÕES:
- Na sérico em 4-6h, depois cada 6-8h até estabilizar
- Volume urinário e densidade
- Sintomas neurológicos
- Se subir rápido demais: SG 5% + DDAVP 1-2 mcg SC pra "freiar" a correção`,

  prescription: (ctx) => {
    const peso = ctx.peso || 70;
    const bolusVol = Math.min(2 * peso, 100); // 2 mL/kg, máx 100 mL
    const bolus = calcularSF3(bolusVol);

    // Pra manutenção, 500 mL de SF 3% (a "preparação clássica")
    const manut = calcularSF3(500);

    return [
      {
        section: "cuidados",
        text: `SE SINTOMAS NEUROLÓGICOS (rebaixamento, convulsão): SF 3% ${bolusVol} mL EV em BOLUS 10 min — preparar com NaCl 20% ${bolus.nacl20} mL + SF 0,9% ${bolus.sf09} mL. Repetir até 3x até melhora neurológica.`,
      },
      {
        section: "hidratacao",
        text: `SF 3% — 500 mL EV em infusão contínua, velocidade conforme correção alvo (preparo: NaCl 20% ${manut.nacl20} mL + SF 0,9% ${manut.sf09} mL).`,
      },
      {
        section: "cuidados",
        text: `META DE CORREÇÃO: 8 a 12 mEq/L em 24h (⚠ NÃO ULTRAPASSAR — risco mielinólise pontina central).`,
      },
      {
        section: "cuidados",
        text: `Restrição hídrica 800-1000 mL/dia (se SIADH/euvolêmica).`,
      },
      {
        section: "exames",
        text: `Na sérico em 4-6h; depois cada 6-8h até estabilizar.`,
      },
      {
        section: "exames",
        text: `Osmolaridade sérica e urinária + Na urinário + TSH + Cortisol AM.`,
      },
      {
        section: "pendencias",
        text: `Investigar etiologia (SIADH? hipovolemia? adrenal? tireoide?). Revisar medicações suspeitas (tiazídicos, ISRS, carbamazepina, opioides).`,
      },
    ];
  },

  warnings: [
    "⚠ MÁXIMO 8-12 mEq/L de correção em 24h — risco de MIELINÓLISE PONTINA CENTRAL",
    "Em idoso, desnutrido ou etilista: limite ainda mais conservador (6-8 mEq/L/24h)",
    "Se Na subir rápido demais: SG 5% EV + DDAVP 1-2 mcg SC pra freiar a correção",
    "Sintomas neurológicos GRAVES (convulsão/coma): bolus de SF 3% 100 mL EV 10min, repetir até 3x",
  ],

  pendencias: [
    "Repetir Na sérico em 4-6h",
    "Investigar etiologia (osmolaridade, Na urinário, TSH, cortisol)",
    "Revisar medicações que causam SIADH (tiazídicos, ISRS, opioides, carbamazepina)",
  ],
};
