import { useEffect, useState } from "react";

export type Patient = {
  id: string;
  bed: string;
  name: string;
  age: number;
  sex: "M" | "F";
  sector: string;
  admission: string;
  hda: string;
  status: "PENDENTE" | "EVOLUÇÃO GERADA" | "ALERTA RENAL" | "ATB D4/7";
  data?: PatientData;
};

export type PatientData = {
  vitals?: { pas?: number; pad?: number; fc?: number; fr?: number; spo2?: number; temp?: number; pasMin?: number; pasMax?: number };
  hgt?: { h06?: number; h12?: number; h18?: number; h00?: number };
  status?: { geral?: string; clinica?: string; hemo?: string; consc?: string; glasgow?: number };
  resp?: { padrao?: string; suporte?: string; o2?: number; modo?: string; fio2?: number; peep?: number; vmFr?: number };
  digest?: { tolerancia?: string; tipo?: string; nauseas?: boolean; vomitos?: boolean; vomitoAspecto?: string; dejecoes?: string; flatos?: string; abdome?: string; dor?: string };
  diurese?: { padrao?: string; via?: string; aspecto?: string; debito?: number; bh?: string; bhValor?: number };
  outros?: { sono?: string; dor?: string; eva?: number; agitacao?: boolean; distermia?: boolean; pico?: number; disglicemia?: boolean };
  abx?: { name: string; dose: string; via: string; freq: string; d0: string; durDays: number }[];
  lab?: { date: string; raw: Record<string, string>; formatted: string };
  pcrHist?: number[];
  exam?: { ect?: string; acv?: string; ar?: string; abd?: string; ext?: string };
  conducta?: { dx?: string; condutas?: string; pendencias?: string; intercorrencias?: string };
};

const KEY = "doutor_ajuda_patients_v1";

const seed: Patient[] = [
  {
    id: "p1", bed: "L01", name: "MARIA DE LOURDES DA SILVA FERREIRA", age: 88, sex: "F",
    sector: "CLÍNICA MÉDICA FEMININA", admission: "2026-04-20",
    hda: "PACIENTE INTERNADA POR PÉ DIABÉTICO INFECTADO, COM ANTECEDENTES DE HAS, DM2 E DAOP.",
    status: "PENDENTE",
    data: {
      abx: [{ name: "CIPROFLOXACINO", dose: "400MG", via: "EV", freq: "12/12H", d0: "2026-03-24", durDays: 7 }],
      pcrHist: [127.8, 1.2, 53],
    },
  },
  { id: "p2", bed: "L02", name: "JOSÉ CARLOS", age: 67, sex: "M", sector: "CLÍNICA MÉDICA MASCULINA", admission: "2026-04-22", hda: "", status: "EVOLUÇÃO GERADA" },
  { id: "p3", bed: "L03", name: "ANA RITA", age: 74, sex: "F", sector: "CLÍNICA MÉDICA FEMININA", admission: "2026-04-21", hda: "", status: "ALERTA RENAL" },
  { id: "p4", bed: "L04", name: "TERESINHA CAMPOS NUNES", age: 80, sex: "F", sector: "CLÍNICA MÉDICA FEMININA", admission: "2026-04-19", hda: "", status: "ATB D4/7",
    data: { abx: [{ name: "CEFTRIAXONA", dose: "1G", via: "EV", freq: "12/12H", d0: "2026-04-25", durDays: 7 }] } },
];

function read(): Patient[] {
  if (typeof window === "undefined") return seed;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) { localStorage.setItem(KEY, JSON.stringify(seed)); return seed; }
    return JSON.parse(raw);
  } catch { return seed; }
}

function write(list: Patient[]) {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(list));
}

import { supabase, hasSupabaseConfig } from "./supabase";

export async function saveEvolution(patientId: string, evolutionText: string) {
  const evolutionsStr = localStorage.getItem("doutor_ajuda_evolutions") || "{}";
  const evolutions = JSON.parse(evolutionsStr);
  
  if (!evolutions[patientId]) {
    evolutions[patientId] = [];
  }
  
  const record = {
    id: Date.now().toString(),
    text: evolutionText,
    created_at: new Date().toISOString()
  };
  
  evolutions[patientId].push(record);
  localStorage.setItem("doutor_ajuda_evolutions", JSON.stringify(evolutions));

  if (hasSupabaseConfig && patientId.length > 10) {
    try {
      await supabase.from("evolutions").insert({
        patient_id: patientId,
        content: evolutionText,
        author: "Dr. Luan Carvalho"
      });
    } catch (e) {
      console.error("Falha ao salvar evolução no Supabase, mantendo local", e);
    }
  }
}

export function usePatients() {
  const [patients, setPatients] = useState<Patient[]>(seed);
  useEffect(() => { setPatients(read()); }, []);
  const refresh = () => setPatients(read());
  
  const updatePatient = async (id: string, updates: Partial<Patient>) => {
    const p = getPatient(id);
    if (!p) return;
    const updated = { ...p, ...updates };
    await savePatient(updated);
    refresh();
  };

  const deletePatientStore = async (id: string) => {
    await deletePatient(id);
    refresh();
  };

  return { patients, refresh, setPatients, updatePatient, deletePatient: deletePatientStore };
}

export function getPatient(id: string): Patient | undefined {
  return read().find((p) => p.id === id);
}

// Salva no localStorage imediatamente e faz push assíncrono pro Supabase
export async function savePatient(p: Patient) {
  const list = read();
  const idx = list.findIndex((x) => x.id === p.id);
  if (idx >= 0) list[idx] = p; else list.push(p);
  write(list);

  if (hasSupabaseConfig && p.id.length > 10) { // IDs mockados têm 2 chars, UUIDs são maiores
    try {
      await supabase.from("patients").upsert({
        id: p.id,
        name: p.name,
        age: p.age,
        sex: p.sex,
        bed: p.bed,
        ward: p.sector,
        admission_date: p.admission,
        hda: p.hda,
        diagnoses_json: p.data,
      });
    } catch (e) {
      console.error("Falha ao sincronizar paciente com Supabase", e);
    }
  }
}

export async function addPatient(p: Omit<Patient, "id" | "status">): Promise<Patient> {
  const list = read();
  // Se Supabase offline, usa timestamp
  const id = hasSupabaseConfig ? crypto.randomUUID() : `p${Date.now()}`;
  const np: Patient = { ...p, id, status: "PENDENTE" };
  
  list.push(np);
  write(list);

  if (hasSupabaseConfig) {
    try {
      await supabase.from("patients").insert({
        id: np.id,
        name: np.name,
        age: np.age,
        sex: np.sex,
        bed: np.bed,
        ward: np.sector,
        admission_date: np.admission,
        hda: np.hda,
      });
    } catch (e) {
      console.error("Falha ao salvar paciente no Supabase", e);
    }
  }
  return np;
}

export async function deletePatient(id: string) {
  const list = read();
  const newList = list.filter(p => p.id !== id);
  write(newList);

  if (hasSupabaseConfig && id.length > 10) {
    try {
      await supabase.from("patients").delete().eq("id", id);
    } catch (e) {
      console.error("Falha ao deletar paciente no Supabase", e);
    }
  }
}
