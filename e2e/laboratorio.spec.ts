import { expect, test } from "@playwright/test";

/**
 * Print Screen → Ctrl+V: o print entra e o laboratório se organiza sozinho.
 *
 * Esse é o jeito como o resultado chega no plantão — copiado da tela do
 * sistema do laboratório. Colar tem de funcionar com o foco em qualquer
 * lugar da tela, não só dentro da caixa de texto.
 */

/** PNG de 1×1: o conteúdo não importa, a IA está em AI_MOCK. */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==";

async function colarPrint(page: import("@playwright/test").Page, quantos = 1) {
  // A tela precisa estar montada para o "ouvido" do Ctrl+V existir.
  await expect(page.getByTestId("resumo-submit")).toBeVisible();
  await page.evaluate(
    ({ b64, quantos }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      for (let i = 0; i < quantos; i++) {
        dt.items.add(new File([bytes], `image${i}.png`, { type: "image/png" }));
      }
      document.body.dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }),
      );
    },
    { b64: PNG_BASE64, quantos },
  );
}

test("Ctrl+V de um print em qualquer lugar da tela organiza sozinho", async ({ page }) => {
  const chamadas: unknown[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/ai/organizar-laboratorio")) chamadas.push(r.postDataJSON());
  });
  await page.goto("/resumo-exames");
  await colarPrint(page);

  await expect(page.getByTestId("resumo-anexos").locator("img")).toHaveCount(1);
  await expect(page.getByTestId("resumo-resultado")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("resumo-resultado")).toContainText("LAB ATUAL");
  expect(chamadas).toHaveLength(1);
  const corpo = chamadas[0] as { imagens: { mime: string }[] };
  expect(corpo.imagens).toHaveLength(1);
  expect(corpo.imagens[0].mime).toBe("image/jpeg");
});

test("dois prints colados em seguida vão juntos numa leitura só", async ({ page }) => {
  let chamadas = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/ai/organizar-laboratorio")) chamadas++;
  });
  await page.goto("/resumo-exames");
  const pedido = page.waitForRequest("**/api/ai/organizar-laboratorio");
  await colarPrint(page);
  await colarPrint(page);
  const corpo = (await pedido).postDataJSON() as { imagens: unknown[] };
  expect(corpo.imagens).toHaveLength(2);
  await expect(page.getByTestId("resumo-resultado")).toBeVisible({ timeout: 20_000 });
  expect(chamadas).toBe(1);
});

test("colar texto continua colando texto", async ({ page }) => {
  await page.goto("/resumo-exames");
  await page.getByTestId("resumo-input").click();
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData("text/plain", "Hb 9,2 K 5,6");
    document
      .getElementById("resumo-input")!
      .dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }),
      );
  });
  await expect(page.getByTestId("resumo-anexos")).toHaveCount(0);
});
