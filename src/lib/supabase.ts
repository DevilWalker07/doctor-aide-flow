import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Doutor Ajuda: variáveis VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não configuradas.')
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '')

// hasSupabaseConfig is kept for backward compatibility with store.ts fallback logic
export const hasSupabaseConfig = !!supabaseUrl && !!supabaseAnonKey
