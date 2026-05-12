import { supabase } from "@/integrations/supabase/client";
import type { Patient } from "@/lib/store";

async function getUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function listRemotePatients(): Promise<Patient[]> {
  const userId = await getUserId();
  if (!userId) return [];
  const db = supabase as any;
  const { data, error } = await db.from("patients").select("*").eq("user_id", userId).order("bed", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    bed: row.bed ?? "",
    name: row.name,
    age: Number(row.age ?? 0),
    sex: row.sex === "F" ? "F" : "M",
    sector: row.ward ?? row.hospital_unit ?? "CLÍNICA MÉDICA",
    admission: row.admission_date ?? "",
    hda: row.hda ?? "",
    status: row.status ?? "PENDENTE",
    data: row.data_json ?? {},
  }));
}

export async function upsertRemotePatient(patient: Patient) {
  const userId = await getUserId();
  if (!userId) return null;
  const db = supabase as any;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(patient.id);
  const { data, error } = await db.from("patients").upsert([{
    id: isUuid ? patient.id : undefined,
    user_id: userId,
    name: patient.name,
    age: String(patient.age),
    sex: patient.sex,
    bed: patient.bed,
    ward: patient.sector,
    hospital_unit: patient.sector,
    admission_date: patient.admission || null,
    hda: patient.hda,
    status: patient.status,
    data_json: patient.data ?? {},
  }]).select("id").single();
  if (error) throw error;
  return data?.id ?? null;
}

export async function createShift(params?: { hospital?: string; unit?: string; ward?: string; shiftDate?: string }) {
  const userId = await getUserId();
  if (!userId) return null;
  const db = supabase as any;
  const { data, error } = await db.from("shifts").insert([{
    user_id: userId,
    hospital: params?.hospital ?? "HNAS",
    unit: params?.unit ?? "Clínica Médica",
    ward: params?.ward ?? "Clínica Médica Masculina",
    shift_date: params?.shiftDate ?? new Date().toISOString().slice(0, 10),
    status: "active",
  }]).select("id").single();
  if (error) throw error;
  return data?.id ?? null;
}

export async function listShifts() {
  const userId = await getUserId();
  if (!userId) return [];
  const db = supabase as any;
  const { data, error } = await db.from("shifts").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
