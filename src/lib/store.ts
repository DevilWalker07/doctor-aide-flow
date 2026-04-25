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

export function usePatients() {
  const [patients, setPatients] = useState<Patient[]>(seed);
  useEffect(() => { setPatients(read()); }, []);
  const refresh = () => setPatients(read());
  return { patients, refresh, setPatients };
}

export function getPatient(id: string): Patient | undefined {
  return read().find((p) => p.id === id);
}

export function savePatient(p: Patient) {
  const list = read();
  const idx = list.findIndex((x) => x.id === p.id);
  if (idx >= 0) list[idx] = p; else list.push(p);
  write(list);
}

export function addPatient(p: Omit<Patient, "id" | "status">): Patient {
  const list = read();
  const np: Patient = { ...p, id: `p${Date.now()}`, status: "PENDENTE" };
  list.push(np);
  write(list);
  return np;
}