/**
 * A criança atual fica guardada no aparelho por algumas horas: se a página
 * recarregar no meio do atendimento, o peso não precisa ser digitado de novo.
 * Nunca vai ao servidor. Falha de armazenamento só desliga a conveniência.
 */
import type { Paciente } from "@/components/pediatria/Identificacao";
import { storage } from "@/lib/storage";

const VALIDADE_MS = 12 * 60 * 60_000;

export function salvarPaciente(p: Paciente | null, agora = Date.now()): void {
  try {
    if (p) storage.setPedPaciente(JSON.stringify({ em: agora, p }));
    else storage.clearPedPaciente();
  } catch {
    /* armazenamento indisponível */
  }
}

export function carregarPaciente(agora = Date.now()): Paciente | null {
  try {
    const raw = storage.getPedPaciente();
    if (!raw) return null;
    const x = JSON.parse(raw) as { em?: number; p?: Paciente };
    if (!x?.p || typeof x.p.peso !== "number" || typeof x.em !== "number") return null;
    if (agora - x.em > VALIDADE_MS) return null;
    return x.p;
  } catch {
    return null;
  }
}

export type AbaPed = "drogas" | "iot" | "choque" | "infusoes";
const ABAS: AbaPed[] = ["drogas", "iot", "choque", "infusoes"];

export function carregarAba(): AbaPed {
  try {
    const a = storage.getPedAba();
    return ABAS.includes(a as AbaPed) ? (a as AbaPed) : "drogas";
  } catch {
    return "drogas";
  }
}

export function salvarAba(a: AbaPed): void {
  try {
    storage.setPedAba(a);
  } catch {
    /* armazenamento indisponível */
  }
}
