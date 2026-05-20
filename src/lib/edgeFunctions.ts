/**
 * Invoca uma Supabase Edge Function via fetch direto, com timeout configurável.
 *
 * Usa fetch direto (não supabase.functions.invoke) porque o supabase-js cancela
 * por timeout em ~60s — e algumas chamadas de IA (gpt-5 com parecer estruturado,
 * chat longo) demoram 90-120s. Aqui controlamos o timeout manualmente.
 *
 * Requer que a function tenha verify_jwt=false (caso contrário precisa de JWT
 * de usuário autenticado, não só a anon key).
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export async function invokeEdgeFunction<T = unknown>(
  name: string,
  body: unknown,
  options: { timeoutMs?: number } = {},
): Promise<T> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
  }

  const timeoutMs = options.timeoutMs ?? 180_000; // 3 min default
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      let detail = `${res.status} ${res.statusText}`;
      try {
        const errBody = await res.json();
        if (errBody?.error) detail = errBody.error;
      } catch { /* ignore */ }
      throw new Error(detail);
    }

    const data = await res.json();
    if (data && typeof data === "object" && "error" in data && data.error) {
      throw new Error(String(data.error));
    }
    return data as T;
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error(`Tempo esgotado após ${Math.round(timeoutMs / 1000)}s. A IA está demorando mais que o esperado — tente novamente.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Invoca uma edge function que retorna SSE (Server-Sent Events) e chama
 * `onDelta` pra cada chunk de texto. Resolve quando o stream termina.
 *
 * Usado pelo chat com especialistas pra streaming de tokens — evita o
 * "Load failed" do iOS Safari em requests longos e dá feedback imediato
 * pro usuário (texto aparece sendo formado).
 *
 * Heartbeat (comentários SSE ":...") mantém a conexão viva mesmo se a IA
 * demora pra gerar.
 */
export async function streamEdgeFunction(
  name: string,
  body: unknown,
  onDelta: (delta: string) => void,
  options: { signal?: AbortSignal } = {},
): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).");
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "apikey": SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
      "Accept": "text/event-stream",
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const errBody = await res.json();
      if (errBody?.error) detail = errBody.error;
    } catch { /* ignore */ }
    throw new Error(detail);
  }

  if (!res.body) {
    throw new Error("Resposta sem body — streaming não suportado.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith(":")) continue; // SSE comment (heartbeat)
        if (!trimmed.startsWith("data:")) continue;

        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") return;

        try {
          const parsed = JSON.parse(data);
          if (parsed.error) throw new Error(parsed.error);
          if (typeof parsed.delta === "string") onDelta(parsed.delta);
        } catch (e: any) {
          if (e?.message && !e.message.startsWith("Unexpected token")) throw e;
          // JSON parse error em chunk parcial — ignora
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
