import { useEffect, useState } from "react";
import { supabase, hasSupabaseConfig } from "./supabase";

export type Sex = "M" | "F";
export type PatientStatus = "PENDENTE" | "EVOLUÇÃO GERADA" | "ALERTA RENAL" | "ATB D4/7";

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

export type Patient = {
  id: string;
  bed: string;
  name: string;
  age: number;
  sex: Sex;
  sector: string;
  ward?: string;
  admissionDate?: string;
  admission: string;
  dih?: number;
  diagnoses?: string[];
  comorbidities?: string[];
  devices?: string[];
  currentStatus?: string;
  pendingIssues?: string[];
  alerts?: string[];
  tags?: string[];
  memory?: string[];
  hda: string;
  status: PatientStatus;
  data?: PatientData & Record<string, unknown>;
};

export type Antibiotic = {
  id: string;
  patientId: string;
  name: string;
  dose?: string;
  route?: string;
  frequency?: string;
  startDate?: string;
  d0OrD1?: "D0" | "D1" | string;
  plannedDurationDays?: number;
  active: boolean;
};

export type LabExam = {
  id: string;
  patientId: string;
  examDate?: string;
  formattedText?: string;
  hb?: number | null;
  ht?: number | null;
  leukocytes?: number | null;
  segmentedPercent?: number | null;
  bandsPercent?: number | null;
  platelets?: number | null;
  creatinine?: number | null;
  urea?: number | null;
  sodium?: number | null;
  potassium?: number | null;
  crp?: number | null;
  easPiocitos?: number | null;
  easNitrite?: string | null;
  alerts?: string[];
  raw?: unknown;
};

export type Evolution = {
  id: string;
  patientId: string;
  shiftId?: string | null;
  date?: string;
  text: string;
  generatedBy?: string;
  createdAt: string;
};

export type Shift = {
  id: string;
  date: string;
  sector?: string;
  workplace?: string;
  active: boolean;
  createdAt: string;
};

export type RoundMap = {
  id: string;
  date: string;
  sector?: string;
  text: string;
  patients: unknown[];
  alerts: string[];
  createdAt: string;
};

export type ImportedYesterdayEvolutions = {
  id: string;
  date: string;
  rawText: string;
  extractedPatients: unknown[];
  createdAt: string;
};

const KEYS = {
  patients: "doutor_ajuda_patients_v2",
  legacyPatients: "doutor_ajuda_patients_v1",
  evolutions: "doutor_ajuda_evolutions_v2",
  legacyEvolutions: "doutor_ajuda_evolutions",
  labExams: "doutor_ajuda_lab_exams_v1",
  activeShift: "doutor_ajuda_active_shift_v1",
  shifts: "doutor_ajuda_shifts_v1",
  roundMaps: "doutor_ajuda_round_maps_v1",
  imports: "doutor_ajuda_imported_yesterday_v1",
};

const seed: Patient[] = [
  {
    id: "p1",
    bed: "L01",
    name: "MARIA DE LOURDES DA SILVA FERREIRA",
    age: 88,
    sex: "F",
    sector: "CLINICA MEDICA FEMININA",
    ward: "CMF",
    admission: "2026-04-20",
    admissionDate: "2026-04-20",
    dih: 5,
    diagnoses: ["PE DIABETICO INFECTADO"],
    comorbidities: ["HAS", "DM2", "DAOP"],
    devices: [],
    currentStatus: "PENDENTE",
    pendingIssues: [],
    alerts: [],
    tags: [],
    memory: [],
    hda: "PACIENTE INTERNADA POR PE DIABETICO INFECTADO, COM ANTECEDENTES DE HAS, DM2 E DAOP.",
    status: "PENDENTE",
    data: {
      abx: [{ name: "CIPROFLOXACINO", dose: "400MG", via: "EV", freq: "12/12H", d0: "2026-03-24", durDays: 7 }],
      pcrHist: [127.8, 1.2, 53],
    },
  },
  { id: "p2", bed: "L02", name: "JOSE CARLOS", age: 67, sex: "M", sector: "CLINICA MEDICA MASCULINA", ward: "CMM", admission: "2026-04-22", admissionDate: "2026-04-22", hda: "", status: "EVOLUÇÃO GERADA", diagnoses: [], comorbidities: [], devices: [], pendingIssues: [], alerts: [], tags: [], memory: [] },
  { id: "p3", bed: "L03", name: "ANA RITA", age: 74, sex: "F", sector: "CLINICA MEDICA FEMININA", ward: "CMF", admission: "2026-04-21", admissionDate: "2026-04-21", hda: "", status: "ALERTA RENAL", diagnoses: [], comorbidities: [], devices: [], pendingIssues: [], alerts: ["ALERTA RENAL"], tags: [], memory: [] },
  { id: "p4", bed: "L04", name: "TERESINHA CAMPOS NUNES", age: 80, sex: "F", sector: "CLINICA MEDICA FEMININA", ward: "CMF", admission: "2026-04-19", admissionDate: "2026-04-19", hda: "", status: "ATB D4/7", diagnoses: [], comorbidities: [], devices: [], pendingIssues: [], alerts: [], tags: [], memory: [], data: { abx: [{ name: "CEFTRIAXONA", dose: "1G", via: "EV", freq: "12/12H", d0: "2026-04-25", durDays: 7 }] } },
];

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID?.() || Date.now().toString(36)}`;
}

function storageAvailable() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readJson<T>(key: string, fallback: T): T {
  if (!storageAvailable()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (storageAvailable()) localStorage.setItem(key, JSON.stringify(value));
}

function normalizePatient(p: any): Patient {
  return {
    id: p.id || id("patient"),
    bed: p.bed || p.leito || "L00",
    name: p.name || p.nome || "PACIENTE SEM NOME",
    age: Number(p.age || p.idade || 0),
    sex: (p.sex || p.sexo || "F") === "M" ? "M" : "F",
    sector: p.sector || p.setor || p.ward || "CLINICA MEDICA",
    ward: p.ward || p.setor,
    admission: p.admission || p.admissionDate || p.admission_date || new Date().toISOString().slice(0, 10),
    admissionDate: p.admissionDate || p.admission || p.admission_date,
    dih: p.dih,
    diagnoses: p.diagnoses || p.diagnosticos || [],
    comorbidities: p.comorbidities || p.comorbidades || [],
    devices: p.devices || p.dispositivos || [],
    currentStatus: p.currentStatus || p.current_status,
    pendingIssues: p.pendingIssues || p.pending_issues || [],
    alerts: p.alerts || [],
    tags: p.tags || [],
    memory: p.memory || [],
    hda: p.hda || "",
    status: p.status || "PENDENTE",
    data: p.data || p.diagnoses_json || {},
  };
}

function readPatientsLocal(): Patient[] {
  const existing = readJson<Patient[] | null>(KEYS.patients, null);
  if (existing?.length) return existing.map(normalizePatient);

  const legacy = readJson<Patient[] | null>(KEYS.legacyPatients, null);
  const migrated = legacy?.length ? legacy.map(normalizePatient) : seed;
  writeJson(KEYS.patients, migrated);
  return migrated;
}

function writePatientsLocal(list: Patient[]) {
  writeJson(KEYS.patients, list.map(normalizePatient));
  writeJson(KEYS.legacyPatients, list.map(normalizePatient));
}

function toSupabasePatient(p: Patient) {
  return {
    id: p.id.length > 10 ? p.id : undefined,
    bed: p.bed,
    name: p.name,
    age: p.age || null,
    sex: p.sex,
    sector: p.sector,
    ward: p.ward || p.sector,
    admission_date: p.admissionDate || p.admission || null,
    dih: p.dih || null,
    diagnoses: p.diagnoses || [],
    comorbidities: p.comorbidities || [],
    devices: p.devices || [],
    current_status: p.currentStatus || p.status,
    pending_issues: p.pendingIssues || [],
    alerts: p.alerts || [],
    tags: p.tags || [],
    memory: p.memory || [],
    data: p.data || {},
  };
}

function fromSupabasePatient(p: any): Patient {
  return normalizePatient({
    id: p.id,
    bed: p.bed,
    name: p.name,
    age: p.age,
    sex: p.sex,
    sector: p.sector || p.ward,
    ward: p.ward,
    admission: p.admission_date,
    admissionDate: p.admission_date,
    dih: p.dih,
    diagnoses: p.diagnoses,
    comorbidities: p.comorbidities,
    devices: p.devices,
    currentStatus: p.current_status,
    pendingIssues: p.pending_issues,
    alerts: p.alerts,
    tags: p.tags,
    memory: p.memory,
    status: p.current_status || "PENDENTE",
    data: p.data,
  });
}

async function trySupabase<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!hasSupabaseConfig) return fallback;
  try {
    return await fn();
  } catch (error) {
    console.warn("Supabase indisponivel, usando fallback local.", error);
    return fallback;
  }
}

export async function getPatients(): Promise<Patient[]> {
  const local = readPatientsLocal();
  return trySupabase<Patient[]>(async () => {
    const { data, error } = await supabase.from("patients").select("*").order("bed", { ascending: true });
    if (error) throw error;
    const mapped = (data || []).map(fromSupabasePatient);
    if (mapped.length) writePatientsLocal(mapped);
    return mapped.length ? mapped : local;
  }, local);
}

export function getPatient(id: string): Patient | undefined {
  return readPatientsLocal().find((p) => p.id === id);
}

export async function savePatient(patient: Patient): Promise<Patient> {
  const normalized = normalizePatient(patient);
  const list = readPatientsLocal();
  const idx = list.findIndex((p) => p.id === normalized.id);
  if (idx >= 0) list[idx] = normalized;
  else list.push(normalized);
  writePatientsLocal(list);

  await trySupabase(async () => {
    const { error } = await supabase.from("patients").upsert(toSupabasePatient(normalized));
    if (error) throw error;
    return true;
  }, false);

  return normalized;
}

export async function updatePatient(id: string, patch: Partial<Patient>): Promise<Patient | undefined> {
  const patient = getPatient(id);
  if (!patient) return undefined;
  return savePatient({ ...patient, ...patch });
}

export async function deletePatient(id: string): Promise<void> {
  writePatientsLocal(readPatientsLocal().filter((p) => p.id !== id));
  await trySupabase(async () => {
    const { error } = await supabase.from("patients").delete().eq("id", id);
    if (error) throw error;
    return true;
  }, false);
}

export async function addPatient(p: Omit<Patient, "id" | "status">): Promise<Patient> {
  return savePatient(normalizePatient({ ...p, id: id("patient"), status: "PENDENTE" }));
}

export async function getActiveShift(): Promise<Shift | null> {
  const local = readJson<Shift | null>(KEYS.activeShift, null);
  return trySupabase<Shift | null>(async () => {
    const { data, error } = await supabase.from("shifts").select("*").eq("active", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (!data) return local;
    const shift = { id: data.id, date: data.date, sector: data.sector, workplace: data.workplace, active: data.active, createdAt: data.created_at };
    writeJson(KEYS.activeShift, shift);
    return shift;
  }, local);
}

export async function saveShift(shift: Shift): Promise<Shift> {
  const shifts = readJson<Shift[]>(KEYS.shifts, []);
  writeJson(KEYS.shifts, [shift, ...shifts.filter((s) => s.id !== shift.id)]);
  if (shift.active) writeJson(KEYS.activeShift, shift);
  await trySupabase(async () => {
    const { error } = await supabase.from("shifts").upsert({
      id: shift.id,
      date: shift.date,
      sector: shift.sector,
      workplace: shift.workplace,
      active: shift.active,
      created_at: shift.createdAt,
    });
    if (error) throw error;
    return true;
  }, false);
  return shift;
}

export async function getEvolutionsByPatient(patientId: string): Promise<Evolution[]> {
  const local = readJson<Record<string, Evolution[]>>(KEYS.evolutions, {})[patientId] || [];
  return trySupabase<Evolution[]>(async () => {
    const { data, error } = await supabase.from("evolutions").select("*").eq("patient_id", patientId).order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map((e: any) => ({
      id: e.id,
      patientId: e.patient_id,
      shiftId: e.shift_id,
      date: e.date,
      text: e.evolution_text,
      generatedBy: e.generated_by,
      createdAt: e.created_at,
    }));
  }, local);
}

export async function saveEvolution(evolutionOrPatientId: Evolution | string, evolutionText?: string): Promise<Evolution> {
  const evolution: Evolution = typeof evolutionOrPatientId === "string"
    ? { id: id("evolution"), patientId: evolutionOrPatientId, text: evolutionText || "", generatedBy: "DOUTOR AJUDA", createdAt: new Date().toISOString(), date: new Date().toISOString().slice(0, 10) }
    : { ...evolutionOrPatientId, id: evolutionOrPatientId.id || id("evolution"), createdAt: evolutionOrPatientId.createdAt || new Date().toISOString() };

  const all = readJson<Record<string, Evolution[]>>(KEYS.evolutions, {});
  all[evolution.patientId] = [evolution, ...(all[evolution.patientId] || []).filter((e) => e.id !== evolution.id)];
  writeJson(KEYS.evolutions, all);

  const legacy = readJson<Record<string, any[]>>(KEYS.legacyEvolutions, {});
  legacy[evolution.patientId] = [{ id: evolution.id, text: evolution.text, created_at: evolution.createdAt }, ...(legacy[evolution.patientId] || [])];
  writeJson(KEYS.legacyEvolutions, legacy);

  await trySupabase(async () => {
    const { error } = await supabase.from("evolutions").upsert({
      id: evolution.id.startsWith("evolution_") ? undefined : evolution.id,
      patient_id: evolution.patientId,
      shift_id: evolution.shiftId || null,
      date: evolution.date,
      evolution_text: evolution.text,
      generated_by: evolution.generatedBy,
      created_at: evolution.createdAt,
    });
    if (error) throw error;
    return true;
  }, false);

  return evolution;
}

export async function getLabExamsByPatient(patientId: string): Promise<LabExam[]> {
  const local = readJson<Record<string, LabExam[]>>(KEYS.labExams, {})[patientId] || [];
  return trySupabase<LabExam[]>(async () => {
    const { data, error } = await supabase.from("lab_exams").select("*").eq("patient_id", patientId).order("exam_date", { ascending: false });
    if (error) throw error;
    return (data || []).map((l: any) => ({
      id: l.id,
      patientId: l.patient_id,
      examDate: l.exam_date,
      formattedText: l.formatted_text,
      hb: l.hb,
      ht: l.ht,
      leukocytes: l.leukocytes,
      segmentedPercent: l.segmented_percent,
      bandsPercent: l.bands_percent,
      platelets: l.platelets,
      creatinine: l.creatinine,
      urea: l.urea,
      sodium: l.sodium,
      potassium: l.potassium,
      crp: l.crp,
      easPiocitos: l.eas_piocitos,
      easNitrite: l.eas_nitrite,
      alerts: l.alerts || [],
      raw: l.raw_ai_response,
    }));
  }, local);
}

export async function saveLabExam(labExam: LabExam): Promise<LabExam> {
  const record = { ...labExam, id: labExam.id || id("lab") };
  const all = readJson<Record<string, LabExam[]>>(KEYS.labExams, {});
  all[record.patientId] = [record, ...(all[record.patientId] || []).filter((l) => l.id !== record.id)];
  writeJson(KEYS.labExams, all);
  await trySupabase(async () => {
    const { error } = await supabase.from("lab_exams").upsert({
      id: record.id.startsWith("lab_") ? undefined : record.id,
      patient_id: record.patientId,
      exam_date: record.examDate,
      formatted_text: record.formattedText,
      hb: record.hb,
      ht: record.ht,
      leukocytes: record.leukocytes,
      segmented_percent: record.segmentedPercent,
      bands_percent: record.bandsPercent,
      platelets: record.platelets,
      creatinine: record.creatinine,
      urea: record.urea,
      sodium: record.sodium,
      potassium: record.potassium,
      crp: record.crp,
      eas_piocitos: record.easPiocitos,
      eas_nitrite: record.easNitrite,
      alerts: record.alerts || [],
      raw_ai_response: record.raw || null,
    });
    if (error) throw error;
    return true;
  }, false);
  return record;
}

export async function saveRoundMap(roundMap: RoundMap): Promise<RoundMap> {
  const record = { ...roundMap, id: roundMap.id || id("round"), createdAt: roundMap.createdAt || new Date().toISOString() };
  writeJson(KEYS.roundMaps, [record, ...readJson<RoundMap[]>(KEYS.roundMaps, []).filter((r) => r.id !== record.id)]);
  await trySupabase(async () => {
    const { error } = await supabase.from("round_maps").upsert({
      id: record.id.startsWith("round_") ? undefined : record.id,
      date: record.date,
      sector: record.sector,
      map_text: record.text,
      patients: record.patients,
      alerts: record.alerts,
      created_at: record.createdAt,
    });
    if (error) throw error;
    return true;
  }, false);
  return record;
}

export async function getRoundMaps(): Promise<RoundMap[]> {
  const local = readJson<RoundMap[]>(KEYS.roundMaps, []);
  return trySupabase<RoundMap[]>(async () => {
    const { data, error } = await supabase.from("round_maps").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map((r: any) => ({
      id: r.id,
      date: r.date,
      sector: r.sector,
      text: r.map_text,
      patients: r.patients || [],
      alerts: r.alerts || [],
      createdAt: r.created_at,
    }));
  }, local);
}

export async function saveImportedYesterdayEvolutions(importResult: ImportedYesterdayEvolutions): Promise<ImportedYesterdayEvolutions> {
  const record = { ...importResult, id: importResult.id || id("import"), createdAt: importResult.createdAt || new Date().toISOString() };
  writeJson(KEYS.imports, [record, ...readJson<ImportedYesterdayEvolutions[]>(KEYS.imports, []).filter((r) => r.id !== record.id)]);
  await trySupabase(async () => {
    const { error } = await supabase.from("imported_yesterday_evolutions").upsert({
      id: record.id.startsWith("import_") ? undefined : record.id,
      date: record.date,
      raw_text: record.rawText,
      extracted_patients: record.extractedPatients,
      created_at: record.createdAt,
    });
    if (error) throw error;
    return true;
  }, false);
  return record;
}

export function usePatients() {
  const [patients, setPatients] = useState<Patient[]>(seed);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    setPatients(await getPatients());
    setLoading(false);
  };

  useEffect(() => {
    refresh();

    if (hasSupabaseConfig) {
      const channel = supabase
        .channel("patients_changes")
        .on("postgres_changes", { event: "*", schema: "public", table: "patients" }, () => refresh())
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    }
  }, []);

  return {
    patients,
    refresh,
    setPatients,
    updatePatient: async (id: string, patch: Partial<Patient>) => {
      await updatePatient(id, patch);
      await refresh();
    },
    deletePatient: async (id: string) => {
      await deletePatient(id);
      await refresh();
    },
    loading,
  };
}
