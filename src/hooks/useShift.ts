import { useState, useEffect, useCallback } from 'react'
import { getActiveShift as dbGetActiveShift, type Shift } from '../lib/db'
import { storage } from '../lib/storage'
import { useSupabaseUser } from './useSupabaseUser'

export interface ShiftContext {
  id: string
  data: string
  data_formatada: string
  hospital: string
  setor: string | null
  tipo: string | null
  status: 'active' | 'finished' | string
  criado_em: number
  // Supabase fields mapped for convenience
  date?: string
  sector?: string
  type?: string
}

export function useShift() {
  const { userId } = useSupabaseUser()
  const [shift, setShift] = useState<ShiftContext | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    async function load() {
      try {
        const s = await dbGetActiveShift(userId!)
        if (s) {
          const ctx = supabaseToContext(s)
          setShift(ctx)
          syncToLocal(s)
        } else {
          const local = readLocal()
          if (local) setShift(local)
        }
      } catch {
        const local = readLocal()
        if (local) setShift(local)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [userId])

  const refreshShift = useCallback(() => {
    if (!userId) return
    setLoading(true)
    dbGetActiveShift(userId)
      .then(s => {
        if (s) {
          const ctx = supabaseToContext(s)
          setShift(ctx)
          syncToLocal(s)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  // Legacy getShift for backward compat with cadastro-manual etc.
  const getShift = useCallback((): ShiftContext | null => {
    if (shift) return shift
    return readLocal()
  }, [shift])

  const getTipo = useCallback((): string | null => {
    if (shift?.tipo) return shift.tipo
    return storage.getTipo()
  }, [shift])

  const clearShift = useCallback(() => {
    setShift(null)
    storage.clearShiftId()
    localStorage.removeItem('da_plantao_ativo') // Keep legacy cleanup for now
    localStorage.removeItem('da_tipo_evolucao')
  }, [])

  // Legacy updateShift for local-only updates (used by tipo.tsx old path)
  const updateShiftLocal = useCallback((updates: Partial<ShiftContext>) => {
    setShift(prev => {
      if (!prev) return prev
      const updated = { ...prev, ...updates }
      localStorage.setItem('da_plantao_ativo', JSON.stringify(updated))
      if (updates.tipo) storage.setTipo(updates.tipo)
      return updated
    })
  }, [])

  return {
    shift,
    loading,
    refreshShift,
    getShift,
    getTipo,
    clearShift,
    updateShift: updateShiftLocal,
  }
}

function readLocal(): ShiftContext | null {
  try {
    const raw = localStorage.getItem('da_plantao_ativo')
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function supabaseToContext(s: Shift): ShiftContext {
  return {
    id: s.id,
    data: s.date,
    data_formatada: formatDate(s.date),
    hospital: s.hospital || '',
    setor: s.sector || null,
    tipo: s.type || null,
    status: s.status || 'active',
    criado_em: new Date(s.created_at).getTime(),
    date: s.date,
    sector: s.sector,
    type: s.type,
  }
}

function syncToLocal(s: Shift) {
  storage.setShiftId(s.id)
  localStorage.setItem('da_plantao_ativo', JSON.stringify(supabaseToContext(s)))
  if (s.type) storage.setTipo(s.type)
}

function formatDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-')
    return `${d}/${m}/${y}`
  } catch {
    return dateStr
  }
}
