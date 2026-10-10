import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasSupabaseConfig) {
  console.warn(
    "Medfluxo: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY não configuradas — modo local sem login.",
  );
}

/**
 * Toda chamada ao Supabase com prazo.
 *
 * Supabase que não responde não dá erro — pendura. E as telas só caem na
 * reserva local (localStorage) quando a chamada FALHA: pendurada, o plantão
 * ficava num spinner sem fim. Com prazo, vira erro e a reserva entra.
 */
const PRAZO_SUPABASE_MS = 6_000;

function fetchComPrazo(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const prazo = AbortSignal.timeout(PRAZO_SUPABASE_MS);
  const signal = init?.signal ? AbortSignal.any([init.signal, prazo]) : prazo;
  return fetch(input, { ...init, signal });
}

export const supabase = createClient(
  supabaseUrl || "http://localhost:54321",
  supabaseAnonKey || "anon-key-nao-configurada",
  {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    global: { fetch: fetchComPrazo },
  },
);
