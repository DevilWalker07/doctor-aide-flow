/**
 * Regras do algoritmo de PCR pediátrica (PALS/AHA 2020) usadas pelo modo
 * RCP. Puro: o relógio vem de fora, para os testes controlarem o tempo.
 */

export const COMPRESSOES_POR_MINUTO = 110; // faixa 100–120
export const CICLO_MS = 2 * 60_000;
export const ADRENALINA_MIN_MS = 3 * 60_000;
export const ADRENALINA_MAX_MS = 5 * 60_000;
/** Via aérea avançada: 1 ventilação a cada 2–3 s (20–30/min). */
export const VENTILACAO_VA_MS = 2500;

export type Ritmo = "chocavel" | "nao-chocavel";

/** Relação compressão:ventilação sem via aérea avançada. */
export type Relacao = "15:2" | "30:2" | "continua";

export type EstadoAdrenalina = "aguardando" | "pode" | "atrasada";

export function estadoAdrenalina(desdeUltimaMs: number | null): EstadoAdrenalina {
  if (desdeUltimaMs === null) return "pode";
  if (desdeUltimaMs < ADRENALINA_MIN_MS) return "aguardando";
  if (desdeUltimaMs <= ADRENALINA_MAX_MS) return "pode";
  return "atrasada";
}

/**
 * O que o algoritmo sugere após a checagem de ritmo. No ritmo chocável a
 * adrenalina entra depois do 2º choque; a amiodarona após o 3º (até 3 doses).
 * No não chocável, adrenalina o quanto antes.
 */
export function sugestoes(p: {
  ritmo: Ritmo;
  choques: number;
  adrenalinas: number;
  amiodaronas: number;
  adrenalinaLiberada: boolean;
}): string[] {
  const s: string[] = [];
  if (p.ritmo === "chocavel") {
    s.push("Choque e retome a RCP imediatamente por 2 min.");
    if (p.choques >= 2 && p.adrenalinaLiberada)
      s.push("Adrenalina agora (repetir a cada 3–5 min).");
    if (p.choques >= 3 && p.amiodaronas < 3) s.push("Amiodarona 5 mg/kg (ou lidocaína 1 mg/kg).");
  } else {
    if (p.adrenalinaLiberada) {
      s.push(p.adrenalinas === 0 ? "Adrenalina o quanto antes." : "Adrenalina (a cada 3–5 min).");
    }
    s.push("RCP por 2 min. Busque causas reversíveis.");
  }
  s.push("Via aérea avançada? Capnografia.");
  return s;
}

export const CAUSAS_REVERSIVEIS = {
  H: [
    "Hipovolemia",
    "Hipóxia",
    "Hidrogênio (acidose)",
    "Hipoglicemia",
    "Hipo/hipercalemia",
    "Hipotermia",
  ],
  T: [
    "Tensão no tórax (pneumotórax)",
    "Tamponamento cardíaco",
    "Toxinas",
    "Trombose pulmonar",
    "Trombose coronária",
  ],
};

export function formatarTempo(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
