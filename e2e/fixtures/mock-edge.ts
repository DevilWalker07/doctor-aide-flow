import type { Page } from "@playwright/test";

/**
 * Intercepta TODAS as chamadas pra /functions/v1/<nome> e responde com mocks.
 *
 * O front faz POST direto pra ${VITE_SUPABASE_URL}/functions/v1/<name> via
 * invokeEdgeFunction. Aqui interceptamos antes da request sair, devolvendo
 * payloads estáticos pra os tests serem rápidos e determinísticos.
 */
export type EdgeMock = (body: unknown) => unknown | Promise<unknown>;

export async function mockEdgeFunctions(page: Page, mocks: Record<string, EdgeMock>) {
  await page.route(/\/functions\/v1\/([^/?#]+)/, async (route) => {
    const url = new URL(route.request().url());
    const name = url.pathname.split("/functions/v1/")[1]?.split("/")[0] ?? "";
    const mock = mocks[name];
    if (!mock) {
      await route.continue();
      return;
    }
    let body: unknown = null;
    try {
      body = await route.request().postDataJSON();
    } catch { /* request sem body */ }
    const result = await mock(body);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(result ?? {}),
    });
  });
}

/**
 * Mocks de edge functions que retornam Server-Sent Events (streaming).
 *
 * Usado pelo specialist-chat: o cliente lê data: {"delta":"..."} chunks
 * e monta a mensagem incrementalmente. O mock devolve o mesmo formato,
 * dividido em chunks pra simular streaming real.
 *
 * - Se a função retornar string → manda como delta único + [DONE]
 * - Se retornar string[] → manda cada item como delta separado + [DONE]
 *   (simula streaming real letra-por-letra ou frase-por-frase)
 * - Se retornar { error: string } → manda data: {"error":"..."}\n\n
 * - Se retornar { status: number, body: any } → manda como response não-SSE
 *   (útil pra testar caminho de erro HTTP)
 */
export type StreamMock = (body: unknown) =>
  | string
  | string[]
  | { error: string }
  | { status: number; body: any }
  | Promise<string | string[] | { error: string } | { status: number; body: any }>;

export async function mockStreamingEdgeFunctions(
  page: Page,
  mocks: Record<string, StreamMock>,
) {
  await page.route(/\/functions\/v1\/([^/?#]+)/, async (route) => {
    const url = new URL(route.request().url());
    const name = url.pathname.split("/functions/v1/")[1]?.split("/")[0] ?? "";
    const mock = mocks[name];
    if (!mock) {
      await route.continue();
      return;
    }
    let body: unknown = null;
    try {
      body = await route.request().postDataJSON();
    } catch { /* request sem body */ }

    const result = await mock(body);

    // Caso: HTTP error não-SSE
    if (typeof result === "object" && result !== null && "status" in result && "body" in result) {
      const r = result as { status: number; body: any };
      await route.fulfill({
        status: r.status,
        contentType: "application/json",
        body: typeof r.body === "string" ? r.body : JSON.stringify(r.body),
      });
      return;
    }

    // Monta corpo SSE
    const lines: string[] = [];
    if (typeof result === "object" && result !== null && "error" in result) {
      lines.push(`data: ${JSON.stringify({ error: (result as any).error })}`);
      lines.push("");
    } else {
      const deltas = Array.isArray(result) ? result : [String(result)];
      for (const d of deltas) {
        lines.push(`data: ${JSON.stringify({ delta: d })}`);
        lines.push("");
      }
      lines.push("data: [DONE]");
      lines.push("");
    }

    await route.fulfill({
      status: 200,
      contentType: "text/event-stream; charset=utf-8",
      headers: {
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
      body: lines.join("\n"),
    });
  });
}

/**
 * Seta o doctor name no localStorage antes da app carregar.
 * App lê `da_local_user_name`, `da_nome_medico` etc.
 *
 * Auth real é bypassado em E2E via VITE_E2E=true (ver __root.tsx) — não
 * precisa mockar sessão Supabase aqui.
 */
export async function seedLocalUser(page: Page, name = "TESTE PLAYWRIGHT") {
  await page.addInitScript((n) => {
    localStorage.setItem("da_local_user_name", n);
    localStorage.setItem("da_nome_medico", n);
    localStorage.setItem("da_local_user_id", "00000000-0000-0000-0000-000000000001");
  }, name);
}
