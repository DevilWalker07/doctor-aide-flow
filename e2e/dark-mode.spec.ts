import { test, expect } from "@playwright/test";
import { seedLocalUser } from "./fixtures/mock-edge";

test.describe("Dark mode", () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalUser(page);
    // garante começar em light pra teste ser determinístico
    await page.addInitScript(() => localStorage.setItem("da_theme", "light"));
  });

  async function rgbToHex(rgb: string): Promise<string> {
    const m = rgb.match(/\d+/g);
    if (!m || m.length < 3) return rgb;
    const [r, g, b] = m.slice(0, 3).map(Number);
    return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
  }

  test("/lab-rapido: light tem fundo claro; toggle pra dark muda fundo pra escuro", async ({ page }) => {
    await page.goto("/lab-rapido");

    // No light, background deve ser bem claro (#FAFBFC)
    const lightBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const lightHex = await rgbToHex(lightBg);
    expect(lightHex).toMatch(/^#F[A-F0-9]/i); // começa com F = claro

    // Alterna pra dark via ThemeToggle
    await page.getByRole("button", { name: /tema escuro/i }).click();

    // Aguarda classe .dark no html
    await expect(page.locator("html")).toHaveClass(/dark/);

    // Background dark deve ser escuro (#0B1120)
    const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const darkHex = await rgbToHex(darkBg);
    expect(darkHex).toMatch(/^#0[A-F0-9]/i); // começa com 0 = escuro

    // localStorage persistiu
    const saved = await page.evaluate(() => localStorage.getItem("da_theme"));
    expect(saved).toBe("dark");
  });

  test("/especialistas: dark mode tem texto legível (foreground claro contra background escuro)", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("da_theme", "dark"));
    await page.goto("/especialistas");

    await expect(page.locator("html")).toHaveClass(/dark/);

    // foreground deve ser claro (E2E8F0 — slate-200)
    const fg = await page.evaluate(() => getComputedStyle(document.body).color);
    const fgHex = await rgbToHex(fg);
    expect(fgHex).toMatch(/^#[CDE][A-F0-9]/i); // C/D/E = claro

    // Card do Dr. Victor deve estar visível com texto legível
    await expect(page.getByText(/dr\. victor/i)).toBeVisible();
  });
});
