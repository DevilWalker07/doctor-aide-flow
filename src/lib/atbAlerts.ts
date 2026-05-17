/**
 * Alertas clínicos de ATB próximos de reavaliação.
 *
 * Regras (configuráveis em /configuracoes):
 * - D1–D4: sem alerta (level "ok")
 * - D5–D6: amarelo "próximo de reavaliação"
 * - D7+:  vermelho "requer reavaliação obrigatória"
 * - Se médico registrou reavaliação nas últimas 48h: alerta silenciado.
 */

import { calcularDiaAtb } from "./medical/antibiotico";
import { storage } from "./storage";

export type AlertLevel = "ok" | "yellow" | "red";

export interface RawATB {
  nome?: string;
  name?: string;
  dose?: string;
  via?: string;
  frequencia?: string;
  data_inicio?: string;
  dataInicio?: string;
  d0?: string;
}

export interface ATBWithAlert {
  nome: string;
  dia: number;
  level: AlertLevel;
  silenciado: boolean;
  ultimaReavaliacao?: string;
  data_inicio?: string;
  dose?: string;
  via?: string;
  frequencia?: string;
}

const SILENCIO_MS = 48 * 60 * 60 * 1000;
const REAVAL_KEY = "da_atb_reavaliacoes";

function readConfig() {
  const modo = (storage.getAtbDayRule() || "D0") as "D0" | "D1";
  const diaAmarelo = parseInt(localStorage.getItem("da_atb_dia_amarelo") || "5", 10);
  const diaVermelho = parseInt(localStorage.getItem("da_atb_dia_vermelho") || "7", 10);
  return { modo, diaAmarelo, diaVermelho };
}

function reavalKey(patientId: string, nomeAtb: string): string {
  return `${patientId}::${nomeAtb.trim().toUpperCase()}`;
}

function readReavaliacoes(): Record<string, { ultima_reavaliacao_iso: string }> {
  try { return JSON.parse(localStorage.getItem(REAVAL_KEY) || "{}"); } catch { return {}; }
}

export function registrarReavaliacao(patientId: string, nomeAtb: string): void {
  const map = readReavaliacoes();
  map[reavalKey(patientId, nomeAtb)] = { ultima_reavaliacao_iso: new Date().toISOString() };
  localStorage.setItem(REAVAL_KEY, JSON.stringify(map));
}

export function isReavaliacaoSilenciada(patientId: string, nomeAtb: string): { silenciado: boolean; ultima?: string } {
  const map = readReavaliacoes();
  const entry = map[reavalKey(patientId, nomeAtb)];
  if (!entry) return { silenciado: false };
  const ms = Date.now() - new Date(entry.ultima_reavaliacao_iso).getTime();
  return { silenciado: ms < SILENCIO_MS, ultima: entry.ultima_reavaliacao_iso };
}

function getATBStartDate(a: RawATB): string | undefined {
  return a.data_inicio || a.dataInicio || a.d0;
}

function getATBName(a: RawATB): string {
  return (a.nome || a.name || "ATB").toUpperCase();
}

function diaAtbToday(a: RawATB, modo: "D0" | "D1"): number | null {
  const start = getATBStartDate(a);
  if (!start) return null;
  const today = new Date().toISOString().slice(0, 10);
  const dia = calcularDiaAtb(start, today, modo);
  return Number.isFinite(dia) ? dia : null;
}

export interface PatientForATBAlert {
  id?: string;
  antibioticos?: RawATB[];
  antibiotics?: RawATB[];
  data?: { abx?: RawATB[] };
}

function getATBsFromPatient(p: PatientForATBAlert): RawATB[] {
  if (Array.isArray(p.antibioticos) && p.antibioticos.length) return p.antibioticos;
  if (Array.isArray(p.antibiotics) && p.antibiotics.length) return p.antibiotics;
  if (Array.isArray(p.data?.abx) && p.data.abx.length) return p.data.abx as RawATB[];
  return [];
}

export function getATBsWithAlert(patient: PatientForATBAlert): ATBWithAlert[] {
  const cfg = readConfig();
  const list = getATBsFromPatient(patient);
  return list.map((a) => {
    const dia = diaAtbToday(a, cfg.modo) ?? 0;
    const nomeNorm = getATBName(a);
    const sil = patient.id ? isReavaliacaoSilenciada(patient.id, nomeNorm) : { silenciado: false };
    let level: AlertLevel = "ok";
    if (!sil.silenciado) {
      if (dia >= cfg.diaVermelho) level = "red";
      else if (dia >= cfg.diaAmarelo) level = "yellow";
    }
    return {
      nome: nomeNorm, dia, level, silenciado: sil.silenciado,
      ultimaReavaliacao: sil.ultima, data_inicio: getATBStartDate(a),
      dose: a.dose, via: a.via, frequencia: a.frequencia,
    };
  });
}

export const ATB_ALERT_STYLES: Record<AlertLevel, { bg: string; text: string; label: string; border: string }> = {
  ok: { bg: "bg-emerald-50", text: "text-emerald-700", label: "OK", border: "border-emerald-200" },
  yellow: { bg: "bg-amber-100", text: "text-amber-700", label: "REVISAR EM BREVE", border: "border-amber-300" },
  red: { bg: "bg-red-100", text: "text-red-700", label: "REAVALIAR JÁ", border: "border-red-300" },
};
