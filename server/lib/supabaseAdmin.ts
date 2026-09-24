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

/** Estado real da ligação com o Supabase, do ponto de vista do backend. */
export type EstadoSupabase = "ok" | "sem_tabela" | "chave_invalida" | "inalcancavel" | "ausente";

/**
 * Sonda o Supabase de verdade, em vez de conferir se as variáveis existem.
 *
 * `hasSupabase()` respondia `true` com a chave revogada, com a tabela faltando
 * e com o banco fora do ar — e o `/health` repetia esse `true` como se fosse
 * saúde. Foi assim que `extraction_jobs` ficou meses ausente em produção sem
 * ninguém notar: o painel dizia verde e a passagem de plantão morria no
 * `jobStore.create`, sem ligação visível entre uma coisa e outra.
 *
 * A sondagem usa `head: true` — conta linhas sem trazer nenhuma, então custa
 * quase nada e não arrasta dado clínico para dentro de um endpoint público.
 *
 * Nunca lança: falha vira estado. `/health` que cai é `/health` que não serve
 * para diagnosticar nada.
 */
export async function sondarSupabase(timeoutMs = 3_000): Promise<EstadoSupabase> {
  const admin = getSupabaseAdmin();
  if (!admin) return "ausente";

  const expirar = new Promise<"inalcancavel">((resolve) =>
    setTimeout(() => resolve("inalcancavel"), timeoutMs).unref?.(),
  );

  const sondar = (async (): Promise<EstadoSupabase> => {
    try {
      const { error } = await admin
        .from("extraction_jobs")
        .select("job_id", { head: true, count: "exact" })
        .limit(1);
      if (!error) return "ok";

      // 42P01 é "relation does not exist" no Postgres; o PostgREST devolve
      // PGRST205 quando a tabela não está no schema exposto.
      if (error.code === "42P01" || error.code === "PGRST205") return "sem_tabela";
      if (/jwt|api key|unauthorized|invalid/i.test(error.message)) return "chave_invalida";
      return "inalcancavel";
    } catch {
      return "inalcancavel";
    }
  })();

  return Promise.race([sondar, expirar]);
}
