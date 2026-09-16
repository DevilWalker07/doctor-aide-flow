import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, hasSupabase } from "../config.js";

let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!hasSupabase()) return null;
  if (!client) {
    client = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export { hasSupabase };
