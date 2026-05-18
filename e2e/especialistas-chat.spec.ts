import { test, expect } from "@playwright/test";
import { mockEdgeFunctions, seedLocalUser } from "./fixtures/mock-edge";

test.describe("/especialistas — chat livre", () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalUser(page);
    // Limpa histórico do chat pra cada teste começar do zero
    await page.addInitScript(() => {
      for (const key of ["da_chat_victor", "da_chat_ana", "da_chat_cris", "da_chat_bruno", "da_chat_lucia"]) {
        localStorage.removeItem(key);
      }
    });
  });

  test("lista mostra os 5 especialistas", async ({ page }) => {
    await page.goto("/especialistas");
    await expect(page.getByText(/dr\. victor/i)).toBeVisible();
    await expect(page.getByText(/dra\. ana/i)).toBeVisible();
    await expect(page.getByText(/dra\. cris/i)).toBeVisible();
    await expect(page.getByText(/dr\. bruno/i)).toBeVisible();
    await expect(page.getByText(/dra\. lúcia/i)).toBeVisible();
  });

  test("manda mensagem pro Dr. Victor, recebe resposta mocada", async ({ page }) => {
    await mockEdgeFunctions(page, {
      "specialist-chat": (body: any) => {
        // Valida payload
        expect(body.specialist_id).toBe("victor");
        expect(Array.isArray(body.messages)).toBe(true);
        expect(body.messages.at(-1).role).toBe("user");
        return {
          reply: "Para choque séptico no idoso, iniciaria fluido cristaloide 30 mL/kg em 3h, hemocultura e antibiótico empírico em 1h.",
          generated_at: new Date().toISOString(),
        };
      },
    });

    await page.goto("/especialistas");
    await page.getByText(/dr\. victor/i).click();
    await expect(page).toHaveURL(/\/especialistas\/victor$/);

    // Estado inicial: saudação visível
    await expect(page.getByText(/posso revisar este caso/i)).toBeVisible();

    // Envia mensagem
    const input = page.getByPlaceholder(/fale com dr\. victor/i);
    await input.fill("Idoso com PA 80x40, lactato 4, FC 130. Conduta?");
    await page.getByRole("button", { name: /enviar/i }).click();

    // Mensagem do user aparece
    await expect(page.getByText(/idoso com pa 80x40/i)).toBeVisible();

    // Resposta da IA aparece
    await expect(page.getByText(/choque séptico no idoso, iniciaria fluido/i)).toBeVisible({ timeout: 10_000 });

    // Botão de copiar aparece na mensagem do assistant
    await expect(page.getByRole("button", { name: /copiar/i })).toBeVisible();
  });

  test("histórico fica persistido em localStorage após enviar mensagem", async ({ page }) => {
    await mockEdgeFunctions(page, {
      "specialist-chat": () => ({ reply: "OK, entendi.", generated_at: new Date().toISOString() }),
    });

    await page.goto("/especialistas/victor");
    await page.getByPlaceholder(/fale com dr\. victor/i).fill("Teste de persistência");
    await page.getByRole("button", { name: /enviar/i }).click();
    await expect(page.getByText(/ok, entendi\./i)).toBeVisible({ timeout: 10_000 });

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("da_chat_victor") || "[]"));
    expect(saved.length).toBe(2);
    expect(saved[0].role).toBe("user");
    expect(saved[0].content).toContain("Teste de persistência");
    expect(saved[1].role).toBe("assistant");
  });

  test("erro do edge function não trava o input (permite re-enviar)", async ({ page }) => {
    await mockEdgeFunctions(page, {
      "specialist-chat": () => ({ error: "Timeout da IA" }),
    });

    await page.goto("/especialistas/ana");
    const input = page.getByPlaceholder(/fale com dra\. ana/i);
    await input.fill("Pergunta que vai falhar");
    await page.getByRole("button", { name: /enviar/i }).click();

    // Toast de erro
    await expect(page.getByText(/timeout da ia/i)).toBeVisible({ timeout: 10_000 });
    // Texto da mensagem volta pro input pra retry
    await expect(input).toHaveValue(/pergunta que vai falhar/i);
  });
});
