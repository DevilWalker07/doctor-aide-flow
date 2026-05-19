import { test, expect, devices } from "@playwright/test";
import { seedLocalUser } from "./fixtures/mock-edge";

// Esse spec roda em ambos os projetos (chromium = desktop, mobile-safari = mobile)
// e usa o viewport pra distinguir comportamento esperado.

test.describe("Bottom navigation mobile", () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalUser(page);
  });

  test("/ mostra bottom-nav no mobile, esconde no desktop", async ({ page, viewport }) => {
    await page.goto("/");

    const nav = page.getByRole("navigation", { name: /navegação principal/i });

    const isMobile = (viewport?.width ?? 1280) < 768; // md breakpoint do tailwind
    if (isMobile) {
      await expect(nav).toBeVisible();
      // 5 itens
      await expect(nav.getByRole("link")).toHaveCount(5);
    } else {
      // Desktop: o nav existe no DOM mas tem md:hidden — não deve ser visível
      await expect(nav).toBeHidden();
    }
  });

  test("bottom-nav esconde em /especialistas/<id> (chat tem input fixo)", async ({ page }) => {
    await page.goto("/especialistas/victor");
    const nav = page.getByRole("navigation", { name: /navegação principal/i });
    await expect(nav).toBeHidden();
  });

  test("clicar em 'Lab' no bottom-nav navega pra /lab-rapido", async ({ page, viewport }) => {
    if ((viewport?.width ?? 1280) >= 768) {
      test.skip(true, "Bottom-nav só é visível no mobile");
    }
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: /navegação principal/i });
    await nav.getByRole("link", { name: /lab/i }).click();
    await expect(page).toHaveURL(/\/lab-rapido$/);
  });
});
