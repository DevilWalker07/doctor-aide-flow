import { expect, test } from "@playwright/test";

/**
 * A emergência pediátrica exige conta — mas não pode trancar na sala vermelha.
 * Roda com o Supabase configurado e mudo (`E2E_SUPABASE_MUDO=1`): é o pior
 * caso, sem servidor de login respondendo.
 */
test.skip(process.env.E2E_SUPABASE_MUDO !== "1", "só com E2E_SUPABASE_MUDO=1");

test("sem login, a aba manda para o login e guarda o destino", async ({ page }) => {
  await page.goto("/emergencia-pediatrica?rcp=1");
  await expect(page).toHaveURL(/\/login\?redirect=/);
  await expect(page.getByTestId("login-aviso-pediatria")).toBeVisible();
  expect(decodeURIComponent(page.url())).toContain("/emergencia-pediatrica?rcp=1");
});

test("aparelho liberado entra com o Supabase fora do ar", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "da_ped_acesso",
      JSON.stringify({ userId: "u-teste", ate: Date.now() + 86_400_000 }),
    );
  });
  await page.goto("/emergencia-pediatrica");
  await expect(page.getByTestId("ped-peso")).toBeVisible();
});

test("liberação vencida tranca de novo", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("da_ped_acesso", JSON.stringify({ userId: "u-teste", ate: 1 }));
  });
  await page.goto("/emergencia-pediatrica");
  await expect(page).toHaveURL(/\/login/);
});
