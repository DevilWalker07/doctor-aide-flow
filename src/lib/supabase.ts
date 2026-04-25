import { createClient } from "@supabase/supabase-js";

// Pegamos das variáveis de ambiente. Se não existirem, usamos valores "mock" 
// para evitar erro na inicialização, mas as chamadas para o supabase falharão graciosamente.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://sua-url-supabase.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sua-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const hasSupabaseConfig = !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;
