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
 * Seta o doctor name no localStorage antes da app carregar.
 * App lê `da_local_user_name`, `da_nome_medico` etc.
 */
export async function seedLocalUser(page: Page, name = "TESTE PLAYWRIGHT") {
  await page.addInitScript((n) => {
    localStorage.setItem("da_local_user_name", n);
    localStorage.setItem("da_nome_medico", n);
    localStorage.setItem("da_local_user_id", "00000000-0000-0000-0000-000000000001");
  }, name);
}
