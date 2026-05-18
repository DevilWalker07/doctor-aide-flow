import { test, expect } from "@playwright/test";
import { seedLocalUser } from "./fixtures/mock-edge";

test.describe("Home + atalhos pras features novas", () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalUser(page);
  });

  test("home carrega com botão principal e 2 atalhos visíveis", async ({ page }) => {
    await page.goto("/");

    // CTA principal
    await expect(page.getByRole("button", { name: /iniciar novo plantão/i })).toBeVisible();

    // Atalhos novos
    await expect(page.getByRole("button", { name: /extrair laboratório/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /falar com especialista/i })).toBeVisible();
  });

  test("clicar em 'Extrair laboratório' navega pra /lab-rapido", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /extrair laboratório/i }).click();
    await expect(page).toHaveURL(/\/lab-rapido$/);
    await expect(page.getByRole("heading", { name: /extrair laboratório/i })).toBeVisible();
  });

  test("clicar em 'Falar com especialista' navega pra /especialistas", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /falar com especialista/i }).click();
    await expect(page).toHaveURL(/\/especialistas$/);
    await expect(page.getByRole("heading", { name: /especialistas/i })).toBeVisible();
  });
});
