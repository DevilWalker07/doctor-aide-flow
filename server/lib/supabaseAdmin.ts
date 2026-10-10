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
 * O que o `/health` mostra do Supabase: o estado, para onde a função aponta
 * e, quando falha, por quê.
 *
 * Só o estado não bastava. Em produção ele dizia `inalcancavel` por dias, e
 * nenhuma chamada chegava aos logs do projeto — a função estava apontando para
 * outro endereço, e o health não tinha como dizer qual. `host` é o endereço
 * de `SUPABASE_URL` (não é segredo; a chave nunca aparece aqui) e `motivo` é
 * a causa crua: `ENOTFOUND`, timeout, código do PostgREST.
 */
export interface DiagnosticoSupabase {
  estado: EstadoSupabase;
  host: string | null;
  motivo: string | null;
}

/** Host de `SUPABASE_URL`, ou o valor inválido entre aspas para dar para ver o erro. */
export function hostDoSupabase(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return `URL inválida: "${url.slice(0, 60)}"`;
  }
}

/** Mensagem de erro sem nada que pareça chave: JWT e `sb_secret_…` saem mascarados. */
export function motivoSeguro(texto: string): string {
  return texto
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "<jwt>")
    .replace(/sb_(secret|publishable)_[\w-]+/g, "<chave>")
    .slice(0, 300);
}

function causaDe(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  // `fetch failed` esconde o motivo de verdade (ENOTFOUND, ECONNREFUSED) em `cause`.
  const causa = (err as { cause?: { code?: string; message?: string } }).cause;
  const detalhe = causa?.code ?? causa?.message;
  return detalhe ? `${err.message} (${detalhe})` : err.message;
}

/**
 * Sonda o Supabase de verdade, em vez de conferir se as variáveis existem.
 *
 * `hasSupabase()` respondia `true` com a chave revogada, com a tabela faltando
 * e com o banco fora do ar — e o `/health` repetia esse `true` como se fosse
 * saúde. Foi assim que `extraction_jobs` ficou meses ausente em produção sem
 * ninguém notar.
 *
 * A sondagem usa `head: true` — conta linhas sem trazer nenhuma, então custa
 * quase nada e não arrasta dado clínico para dentro de um endpoint público.
 *
 * Nunca lança: falha vira estado. `/health` que cai é `/health` que não serve
 * para diagnosticar nada.
 */
export async function diagnosticarSupabase(timeoutMs = 3_000): Promise<DiagnosticoSupabase> {
  const host = hostDoSupabase(env.SUPABASE_URL);
  const admin = getSupabaseAdmin();
  if (!admin)
    return { estado: "ausente", host, motivo: "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente" };

  const expirar = new Promise<DiagnosticoSupabase>((resolve) =>
    setTimeout(
      () => resolve({ estado: "inalcancavel", host, motivo: `sem resposta em ${timeoutMs} ms` }),
      timeoutMs,
    ).unref?.(),
  );

  const sondar = (async (): Promise<DiagnosticoSupabase> => {
    try {
      const { error } = await admin
        .from("extraction_jobs")
        .select("job_id", { head: true, count: "exact" })
        .limit(1);
      if (!error) return { estado: "ok", host, motivo: null };

      const motivo = motivoSeguro([error.code, error.message].filter(Boolean).join(": "));
      // 42P01 é "relation does not exist" no Postgres; o PostgREST devolve
      // PGRST205 quando a tabela não está no schema exposto.
      if (error.code === "42P01" || error.code === "PGRST205") {
        return { estado: "sem_tabela", host, motivo };
      }
      if (/jwt|api key|unauthorized|invalid/i.test(error.message)) {
        return { estado: "chave_invalida", host, motivo };
      }
      return { estado: "inalcancavel", host, motivo };
    } catch (err) {
      return { estado: "inalcancavel", host, motivo: motivoSeguro(causaDe(err)) };
    }
  })();

  return Promise.race([sondar, expirar]);
}

/** Só o estado — para quem não precisa do diagnóstico. */
export async function sondarSupabase(timeoutMs = 3_000): Promise<EstadoSupabase> {
  return (await diagnosticarSupabase(timeoutMs)).estado;
}
