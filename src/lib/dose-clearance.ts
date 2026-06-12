/**
 * Cálculo de clearance e ajuste de dose para antibióticos selecionados.
 *
 * IMPORTANTE: Sugestões CONSERVADORAS para uso como referência rápida.
 * NÃO substituem julgamento clínico nem referência oficial (UpToDate,
 * bula). Sempre validar antes de prescrever.
 *
 * Fórmulas:
 * - Cockcroft-Gault: TFGe = ((140-idade) × peso × (0,85 se F)) / (72 × creat)
 *   onde creat em mg/dL. Resultado em mL/min.
 *
 * Ajustes baseados em consenso geral. Para casos críticos (UTI,
 * neutropenia, hemodialise) sempre consultar farmacia clinica.
 */

export interface ClearanceInput {
  idade: number | null;
  peso: number | null;   // kg
  creatinina: number | null; // mg/dL
  sexo: "M" | "F" | "NI" | null;
}

export function cockcroftGault(input: ClearanceInput): number | null {
  const { idade, peso, creatinina, sexo } = input;
  if (!idade || !peso || !creatinina || creatinina <= 0) return null;
  if (idade < 18 || idade > 120) return null; // formula nao validada fora desta faixa
  const factor = sexo === "F" ? 0.85 : 1.0;
  const tfg = ((140 - idade) * peso * factor) / (72 * creatinina);
  return Math.max(0, Math.round(tfg));
}

export interface DoseSugerida {
  dose: string;
  via: string;
  frequencia: string;
  alerta?: string;
  formula?: string;
}

type Ajuste = (tfg: number, peso: number | null) => DoseSugerida;

const AJUSTES: Record<string, Ajuste> = {
  VANCOMICINA: (tfg, _peso) => {
    if (tfg >= 50) return { dose: "1g", via: "IV", frequencia: "12/12h", formula: "TFG ≥ 50" };
    if (tfg >= 20) return { dose: "1g", via: "IV", frequencia: "24/24h", alerta: "Vancocinemia em 48h.", formula: "TFG 20-50" };
    return { dose: "1g", via: "IV", frequencia: "48/48h", alerta: "Consultar nefro/farmácia. Monitorar nível sérico.", formula: "TFG < 20" };
  },
  MEROPENEM: (tfg, _peso) => {
    if (tfg >= 50) return { dose: "1g", via: "IV", frequencia: "8/8h", formula: "TFG ≥ 50" };
    if (tfg >= 25) return { dose: "1g", via: "IV", frequencia: "12/12h", formula: "TFG 25-50" };
    if (tfg >= 10) return { dose: "500mg", via: "IV", frequencia: "12/12h", formula: "TFG 10-25" };
    return { dose: "500mg", via: "IV", frequencia: "24/24h", alerta: "TFG < 10. Avaliar diálise.", formula: "TFG < 10" };
  },
  "PIPERACILINA + TAZOBACTAM": (tfg, _peso) => {
    if (tfg >= 40) return { dose: "4,5g", via: "IV", frequencia: "6/6h", formula: "TFG ≥ 40" };
    if (tfg >= 20) return { dose: "4,5g", via: "IV", frequencia: "8/8h", formula: "TFG 20-40" };
    return { dose: "4,5g", via: "IV", frequencia: "12/12h", alerta: "TFG < 20.", formula: "TFG < 20" };
  },
  CEFEPIME: (tfg, _peso) => {
    if (tfg >= 60) return { dose: "2g", via: "IV", frequencia: "12/12h", formula: "TFG ≥ 60" };
    if (tfg >= 30) return { dose: "2g", via: "IV", frequencia: "24/24h", formula: "TFG 30-60" };
    if (tfg >= 11) return { dose: "1g", via: "IV", frequencia: "24/24h", formula: "TFG 11-30" };
    return { dose: "500mg", via: "IV", frequencia: "24/24h", alerta: "Avaliar diálise.", formula: "TFG ≤ 10" };
  },
  GENTAMICINA: (tfg, peso) => {
    const doseKg = peso ? Math.round(peso * 5) : 240; // 5 mg/kg/dia
    if (tfg >= 60) return { dose: `${doseKg}mg`, via: "IV", frequencia: "24/24h", alerta: "Monitorar pico e vale após 3ª dose.", formula: "Dose única diária 5mg/kg" };
    if (tfg >= 40) return { dose: `${doseKg}mg`, via: "IV", frequencia: "36/36h", alerta: "Monitorar nível sérico.", formula: "TFG 40-60" };
    return { dose: `${doseKg}mg`, via: "IV", frequencia: "48/48h", alerta: "TFG < 40. Considerar evitar.", formula: "TFG < 40" };
  },
  CIPROFLOXACINO: (tfg, _peso) => {
    if (tfg >= 50) return { dose: "400mg", via: "IV", frequencia: "12/12h", formula: "TFG ≥ 50" };
    if (tfg >= 30) return { dose: "400mg", via: "IV", frequencia: "24/24h", formula: "TFG 30-50" };
    return { dose: "200mg", via: "IV", frequencia: "24/24h", alerta: "TFG < 30.", formula: "TFG < 30" };
  },
  LEVOFLOXACINO: (tfg, _peso) => {
    if (tfg >= 50) return { dose: "750mg", via: "VO", frequencia: "24/24h", formula: "TFG ≥ 50" };
    if (tfg >= 20) return { dose: "750mg", via: "VO", frequencia: "48/48h", formula: "TFG 20-50" };
    return { dose: "500mg", via: "VO", frequencia: "48/48h", alerta: "TFG < 20.", formula: "TFG < 20" };
  },
  "POLIMIXINA B": (_tfg, _peso) => ({
    dose: "1MUI", via: "IV", frequencia: "12/12h",
    alerta: "Polimixina B NÃO requer ajuste por TFG (excreção não-renal).",
    formula: "Dose fixa",
  }),
};

/**
 * Retorna sugestão de dose ajustada para o ATB com base no TFG.
 * Retorna null se não tiver fórmula para esse ATB ou TFG inválido.
 */
export function sugerirDose(
  nomeAtb: string,
  tfg: number | null,
  peso: number | null
): DoseSugerida | null {
  if (!tfg && tfg !== 0) return null;
  const key = nomeAtb.trim().toUpperCase();
  const fn = AJUSTES[key];
  if (!fn) return null;
  return fn(tfg, peso);
}

export function classificarTFG(tfg: number): { label: string; color: string } {
  if (tfg >= 90) return { label: "NORMAL", color: "text-emerald-600" };
  if (tfg >= 60) return { label: "DRC LEVE", color: "text-emerald-500" };
  if (tfg >= 30) return { label: "DRC MODERADA", color: "text-amber-500" };
  if (tfg >= 15) return { label: "DRC AVANÇADA", color: "text-orange-500" };
  return { label: "DRC TERMINAL", color: "text-red-600" };
}
