import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasSupabaseConfig) {
  console.warn("Medfluxo: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY não configuradas — modo local sem login.");
}

export const supabase = createClient(supabaseUrl || "http://localhost:54321", supabaseAnonKey || "anon-key-nao-configurada", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
