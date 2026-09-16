import { useEffect, useState } from "react";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { getPatientById } from "@/lib/db";
import { storage } from "@/lib/storage";
import type { PacienteDocumento } from "./types";

export interface PacienteVinculado extends PacienteDocumento {
  pacienteId: string;
  problemas: string[];
  medicacoes: string[];
  antibioticos: string[];
  raw: Record<string, unknown>;
}

type LocalPaciente = Record<string, unknown> & { id?: string };

function normalizeSexo(v: unknown): "M" | "F" | "" {
  const s = String(v ?? "")
    .trim()
    .toUpperCase();
  if (s.startsWith("M")) return "M";
  if (s.startsWith("F")) return "F";
  return "";
}

function strList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) =>
      typeof x === "string"
        ? x
        : x && typeof x === "object"
          ? formatObjItem(x as Record<string, unknown>)
          : String(x ?? ""),
    )
    .filter(Boolean);
}

function formatObjItem(o: Record<string, unknown>): string {
  if (typeof o.text === "string") return o.text;
  const parts = [o.nome, o.dose, o.via, o.frequencia].filter(Boolean).map(String);
  return parts.join(" ");
}

function fromLocal(p: LocalPaciente): PacienteVinculado {
  return {
    pacienteId: String(p.id ?? ""),
    nome: String(p.nome ?? p.name ?? ""),
    idade: p.idade != null || p.age != null ? String(p.idade ?? p.age) : "",
    sexo: normalizeSexo(p.sexo ?? p.sex),
    leito: String(p.leito ?? p.bed ?? ""),
    problemas: strList(p.lista_de_problemas ?? p.problem_list ?? p.diagnoses),
    medicacoes: strList(p.medicacoes ?? p.medications),
    antibioticos: strList(p.antibioticos ?? p.antibiotics),
    raw: p,
  };
}

export function usePacienteVinculado(pacienteId: string | undefined) {
  const { userId } = useSupabaseUser();
  const [paciente, setPaciente] = useState<PacienteVinculado | null>(null);
  const [loading, setLoading] = useState(Boolean(pacienteId));
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!pacienteId) {
      setPaciente(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErro(null);

    (async () => {
      let found: PacienteVinculado | null = null;
      if (!pacienteId.startsWith("temp_") && userId) {
        try {
          const p = await getPatientById(pacienteId, userId);
          if (p) found = fromLocal(p as unknown as LocalPaciente);
        } catch {
          /* cai no fallback local */
        }
      }
      if (!found) {
        const local = (storage.getLocalPacientes() as LocalPaciente[]).find(
          (x) => x.id === pacienteId,
        );
        if (local) found = fromLocal(local);
      }
      if (cancelled) return;
      if (!found) setErro("Paciente não encontrado. Preencha os dados manualmente.");
      setPaciente(found);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [pacienteId, userId]);

  return { paciente, loading, erro, userId };
}
