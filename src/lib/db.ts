import { supabase } from './supabase'

// ═══════════════════════════════════
// TIPOS
// ═══════════════════════════════════

export interface Shift {
  id: string
  user_id: string
  date: string
  hospital: string
  sector: string
  type: string
  status: string
  created_at: string
  updated_at: string
}

export interface Patient {
  id: string
  shift_id: string
  user_id: string
  name: string
  age: string
  sex: string
  bed: string
  sector: string
  admission_date: string
  reason_for_admission: string
  hda: string
  comorbidities: string[]
  problem_list: string[]
  antibiotics: Antibiotic[]
  medications: string[]
  labs: Lab[]
  physical_exam: PhysicalExam
  conducts: string[]
  pending_issues: string[]
  status: string
  tipo_admissao: string
  created_at: string
  updated_at: string
}

export interface Antibiotic {
  nome: string
  dose: string
  via: string
  frequencia: string
  data_inicio: string
}

export interface Lab {
  data: string
  texto_compacto: string
  valores: Record<string, string>
}

export interface PhysicalExam {
  geral?: string
  acv?: string
  ar?: string
  abdome?: string
  neuro?: string
  extremidades?: string
  pele?: string
}

export interface Evolution {
  id: string
  patient_id: string
  shift_id: string
  content: string
  created_at: string
}

export interface Profile {
  id: string
  user_id: string
  name: string
  crm: string
  specialty: string
  hospital: string
}

export interface UserSettings {
  id: string
  user_id: string
  evolution_template: string
  atb_day_rule: string
  atb_alert_days: number
  default_hospital: string
  default_sector: string
}

// ═══════════════════════════════════
// SHIFTS
// ═══════════════════════════════════

export async function createShift(data: {
  date: string
  hospital: string
  sector?: string
  type?: string
}, userId: string): Promise<Shift> {
  const { data: shift, error } = await supabase
    .from('shifts')
    .insert({ ...data, user_id: userId, status: 'active' })
    .select()
    .single()
  if (error) throw error
  return shift
}

export async function getActiveShift(userId: string): Promise<Shift | null> {
  const { data, error } = await supabase
    .from('shifts')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error
  return data?.[0] ?? null
}

export async function updateShift(id: string, data: Partial<Shift>, userId: string): Promise<Shift> {
  const { data: shift, error } = await supabase
    .from('shifts')
    .update(data)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  return shift
}

export async function closeShift(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('shifts')
    .update({ status: 'closed' })
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

export async function getClosedShifts(userId: string, limit = 5): Promise<Shift[]> {
  const { data, error } = await supabase
    .from('shifts')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'closed')
    .order('date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

// ═══════════════════════════════════
// PATIENTS
// ═══════════════════════════════════

export async function createPatient(data: Partial<Patient>, userId: string): Promise<Patient> {
  const { data: patient, error } = await supabase
    .from('patients')
    .insert({ ...data, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return patient
}

export async function getPatientsByShift(shiftId: string, userId: string): Promise<Patient[]> {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('shift_id', shiftId)
    .eq('user_id', userId)
    .order('bed', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getPatientById(id: string, userId: string): Promise<Patient> {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (error) throw error
  return data
}

export async function updatePatient(id: string, data: Partial<Patient>, userId: string): Promise<Patient> {
  const { data: patient, error } = await supabase
    .from('patients')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  return patient
}

export async function mergePatientData(
  id: string,
  newData: Partial<Patient>,
  userId: string
): Promise<Patient> {
  const existing = await getPatientById(id, userId)

  // Start with existing data
  const merged: Partial<Patient> = { ...existing }

  // Overwrite identification if provided and non-empty
  if (newData.name) merged.name = newData.name
  if (newData.age) merged.age = newData.age
  if (newData.sex) merged.sex = newData.sex
  if (newData.bed) merged.bed = newData.bed
  if (newData.sector) merged.sector = newData.sector
  if (newData.admission_date) merged.admission_date = newData.admission_date
  if (newData.reason_for_admission) merged.reason_for_admission = newData.reason_for_admission
  if (newData.hda) merged.hda = newData.hda

  // Merge lists (append new unique items)
  if (newData.problem_list?.length) {
    const existingTexts = new Set((existing.problem_list ?? []).map(p =>
      typeof p === 'string' ? p.trim().toLowerCase() : ''
    ))
    const newProblems = newData.problem_list.filter(
      p => p && !existingTexts.has(p.trim().toLowerCase())
    )
    merged.problem_list = [...(existing.problem_list ?? []), ...newProblems]
  }

  if (newData.antibiotics?.length) {
    const existingNames = new Set((existing.antibiotics ?? []).map(a => a.nome?.trim().toLowerCase()))
    const newAtbs = newData.antibiotics.filter(
      a => a.nome && !existingNames.has(a.nome.trim().toLowerCase())
    )
    merged.antibiotics = [...(existing.antibiotics ?? []), ...newAtbs]
  }

  if (newData.labs?.length) {
    const existingDates = new Set((existing.labs ?? []).map(l => l.data))
    const newLabs = newData.labs.filter(l => l.data && !existingDates.has(l.data))
    merged.labs = [...(existing.labs ?? []), ...newLabs]
  }

  if (newData.medications?.length) {
    const existingTexts = new Set((existing.medications ?? []).map(m =>
      typeof m === 'string' ? m.trim().toLowerCase() : ''
    ))
    const newMeds = newData.medications.filter(
      m => m && !existingTexts.has(m.trim().toLowerCase())
    )
    merged.medications = [...(existing.medications ?? []), ...newMeds]
  }

  if (newData.conducts?.length) {
    const existingTexts = new Set((existing.conducts ?? []).map(c =>
      typeof c === 'string' ? c.trim().toLowerCase() : ''
    ))
    const newConducts = newData.conducts.filter(
      c => c && !existingTexts.has(c.trim().toLowerCase())
    )
    merged.conducts = [...(existing.conducts ?? []), ...newConducts]
  }

  if (newData.pending_issues?.length) {
    const existingTexts = new Set((existing.pending_issues ?? []).map(p =>
      typeof p === 'string' ? p.trim().toLowerCase() : ''
    ))
    const newPending = newData.pending_issues.filter(
      p => p && !existingTexts.has(p.trim().toLowerCase())
    )
    merged.pending_issues = [...(existing.pending_issues ?? []), ...newPending]
  }

  if (newData.physical_exam) {
    merged.physical_exam = {
      ...existing.physical_exam,
      ...Object.fromEntries(
        Object.entries(newData.physical_exam).filter(([, v]) => v != null && v !== '')
      ),
    }
  }

  return updatePatient(id, merged, userId)
}

// ═══════════════════════════════════
// EVOLUTIONS
// ═══════════════════════════════════

export async function createEvolution(data: {
  patient_id: string
  shift_id: string
  content: string
}, userId: string): Promise<Evolution> {
  const { data: evolution, error } = await supabase
    .from('evolutions')
    .insert({ ...data, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return evolution
}

export async function getEvolutionsByPatient(patientId: string, userId: string): Promise<Evolution[]> {
  const { data, error } = await supabase
    .from('evolutions')
    .select('*')
    .eq('patient_id', patientId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getLastEvolution(patientId: string, userId: string): Promise<Evolution | null> {
  const { data, error } = await supabase
    .from('evolutions')
    .select('*')
    .eq('patient_id', patientId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error
  return data?.[0] ?? null
}

// ═══════════════════════════════════
// PRESCRIPTIONS
// ═══════════════════════════════════

export async function createPrescription(data: {
  patient_id: string
  shift_id: string
  content: Record<string, unknown>
}, userId: string) {
  const { data: prescription, error } = await supabase
    .from('prescriptions')
    .insert({ ...data, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return prescription
}

export async function getLastPrescription(patientId: string, userId: string) {
  const { data, error } = await supabase
    .from('prescriptions')
    .select('*')
    .eq('patient_id', patientId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error
  return data?.[0] ?? null
}

// ═══════════════════════════════════
// HANDOFFS
// ═══════════════════════════════════

export async function createHandoff(data: {
  shift_id: string
  content: string
}, userId: string) {
  const { data: handoff, error } = await supabase
    .from('handoffs')
    .insert({ ...data, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return handoff
}

export async function getHandoffsByShift(shiftId: string, userId: string) {
  const { data, error } = await supabase
    .from('handoffs')
    .select('*')
    .eq('shift_id', shiftId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

// ═══════════════════════════════════
// REFERRALS
// ═══════════════════════════════════

export async function createReferral(data: {
  patient_id: string
  destinations: string[]
  specialty?: string
  reason: string
  content: string
}, userId: string) {
  const { data: referral, error } = await supabase
    .from('referrals')
    .insert({ ...data, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return referral
}

// ═══════════════════════════════════
// PROFILES
// ═══════════════════════════════════

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data ?? null
}

export async function upsertProfile(data: Partial<Profile>, userId: string) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .upsert({ ...data, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return profile
}

// ═══════════════════════════════════
// USER SETTINGS
// ═══════════════════════════════════

export async function getSettings(userId: string): Promise<UserSettings | null> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data ?? null
}

export async function upsertSettings(data: Partial<UserSettings>, userId: string) {
  const { data: settings, error } = await supabase
    .from('user_settings')
    .upsert({ ...data, user_id: userId })
    .select()
    .single()
  if (error) throw error
  return settings
}
