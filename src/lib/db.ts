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
}): Promise<Shift> {
  const { data: shift, error } = await supabase
    .from('shifts')
    .insert({ ...data, status: 'active' })
    .select()
    .single()
  if (error) throw error
  return shift
}

export async function getActiveShift(): Promise<Shift | null> {
  const { data, error } = await supabase
    .from('shifts')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw error
  return data?.[0] ?? null
}

export async function updateShift(id: string, data: Partial<Shift>): Promise<Shift> {
  const { data: shift, error } = await supabase
    .from('shifts')
    .update(data)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return shift
}

export async function closeShift(id: string): Promise<void> {
  const { error } = await supabase
    .from('shifts')
    .update({ status: 'closed' })
    .eq('id', id)
  if (error) throw error
}

export async function getClosedShifts(limit = 5): Promise<Shift[]> {
  const { data, error } = await supabase
    .from('shifts')
    .select('*')
    .eq('status', 'closed')
    .order('date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

// ═══════════════════════════════════
// PATIENTS
// ═══════════════════════════════════

export async function createPatient(data: Partial<Patient>): Promise<Patient> {
  const { data: patient, error } = await supabase
    .from('patients')
    .insert(data)
    .select()
    .single()
  if (error) throw error
  return patient
}

export async function getPatientsByShift(shiftId: string): Promise<Patient[]> {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('shift_id', shiftId)
    .order('bed', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getPatientById(id: string): Promise<Patient> {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function updatePatient(id: string, data: Partial<Patient>): Promise<Patient> {
  const { data: patient, error } = await supabase
    .from('patients')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return patient
}

export async function mergePatientData(
  id: string,
  newData: Partial<Patient>
): Promise<Patient> {
  const existing = await getPatientById(id)

  const merged: Partial<Patient> = { ...existing }

  if (newData.problem_list?.length) {
    const existingTexts = (existing.problem_list ?? []).map(p =>
      typeof p === 'string' ? p.toLowerCase() : ''
    )
    const newProblems = newData.problem_list.filter(
      p => !existingTexts.includes((typeof p === 'string' ? p : '').toLowerCase())
    )
    merged.problem_list = [...(existing.problem_list ?? []), ...newProblems]
  }

  if (newData.antibiotics?.length) {
    const existingNames = (existing.antibiotics ?? []).map(a => a.nome?.toLowerCase())
    const newAtbs = newData.antibiotics.filter(
      a => !existingNames.includes(a.nome?.toLowerCase())
    )
    merged.antibiotics = [...(existing.antibiotics ?? []), ...newAtbs]
  }

  if (newData.labs?.length) {
    const existingDates = (existing.labs ?? []).map(l => l.data)
    const newLabs = newData.labs.filter(l => !existingDates.includes(l.data))
    merged.labs = [...(existing.labs ?? []), ...newLabs]
  }

  if (newData.pending_issues?.length) {
    const existingTexts = (existing.pending_issues ?? []).map(p =>
      typeof p === 'string' ? p.toLowerCase() : ''
    )
    const newPending = newData.pending_issues.filter(
      p => !existingTexts.includes((typeof p === 'string' ? p : '').toLowerCase())
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

  return updatePatient(id, merged)
}

// ═══════════════════════════════════
// EVOLUTIONS
// ═══════════════════════════════════

export async function createEvolution(data: {
  patient_id: string
  shift_id: string
  content: string
}): Promise<Evolution> {
  const { data: evolution, error } = await supabase
    .from('evolutions')
    .insert(data)
    .select()
    .single()
  if (error) throw error
  return evolution
}

export async function getEvolutionsByPatient(patientId: string): Promise<Evolution[]> {
  const { data, error } = await supabase
    .from('evolutions')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getLastEvolution(patientId: string): Promise<Evolution | null> {
  const { data, error } = await supabase
    .from('evolutions')
    .select('*')
    .eq('patient_id', patientId)
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
}) {
  const { data: prescription, error } = await supabase
    .from('prescriptions')
    .insert(data)
    .select()
    .single()
  if (error) throw error
  return prescription
}

export async function getLastPrescription(patientId: string) {
  const { data, error } = await supabase
    .from('prescriptions')
    .select('*')
    .eq('patient_id', patientId)
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
}) {
  const { data: handoff, error } = await supabase
    .from('handoffs')
    .insert(data)
    .select()
    .single()
  if (error) throw error
  return handoff
}

export async function getHandoffsByShift(shiftId: string) {
  const { data, error } = await supabase
    .from('handoffs')
    .select('*')
    .eq('shift_id', shiftId)
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
}) {
  const { data: referral, error } = await supabase
    .from('referrals')
    .insert(data)
    .select()
    .single()
  if (error) throw error
  return referral
}

// ═══════════════════════════════════
// PROFILES
// ═══════════════════════════════════

export async function getProfile(): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data ?? null
}

export async function upsertProfile(data: Partial<Profile>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado')
  const { data: profile, error } = await supabase
    .from('profiles')
    .upsert({ ...data, user_id: user.id })
    .select()
    .single()
  if (error) throw error
  return profile
}

// ═══════════════════════════════════
// USER SETTINGS
// ═══════════════════════════════════

export async function getSettings(): Promise<UserSettings | null> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .single()
  if (error && error.code !== 'PGRST116') throw error
  return data ?? null
}

export async function upsertSettings(data: Partial<UserSettings>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Usuário não autenticado')
  const { data: settings, error } = await supabase
    .from('user_settings')
    .upsert({ ...data, user_id: user.id })
    .select()
    .single()
  if (error) throw error
  return settings
}
