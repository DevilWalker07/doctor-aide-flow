import { expect, test } from "@playwright/test";

test.describe("emergência pediátrica", () => {
  test("do hub ao volume da adrenalina com o peso de 11 kg", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("hub-emergencia-pediatrica").click();
    await expect(page).toHaveURL(/\/emergencia-pediatrica/);

    // Sem peso, nenhuma dose.
    await expect(page.getByTestId("ped-calcular")).toBeDisabled();
    await page.getByTestId("ped-peso").fill("11");
    await page.getByTestId("ped-anos").fill("1");
    await page.getByTestId("ped-calcular").click();

    await expect(page.getByTestId("ped-ml-adrenalina-iv")).toContainText("1,1");
    await expect(page.getByTestId("ped-ml-bicarbonato")).toContainText("22");
    await expect(page.getByTestId("ped-paciente-chip")).toContainText("11 kg");
  });

  test("peso que destoa da idade pede confirmação", async ({ page }) => {
    await page.goto("/emergencia-pediatrica");
    await page.getByTestId("ped-peso").fill("25");
    await page.getByTestId("ped-anos").fill("1");
    await expect(page.getByTestId("ped-calcular")).toBeDisabled();
    await page.getByTestId("ped-confirmar-peso").check();
    await expect(page.getByTestId("ped-calcular")).toBeEnabled();
  });

  test("peso estimado pela idade", async ({ page }) => {
    await page.goto("/emergencia-pediatrica");
    await page.getByTestId("ped-anos").fill("5");
    await page.getByTestId("ped-usar-estimado").click();
    await expect(page.getByTestId("ped-peso")).toHaveValue("18");
    await page.getByTestId("ped-calcular").click();
    await expect(page.getByTestId("ped-paciente-chip")).toContainText("est.");
  });

  test("infusão gera texto de prescrição", async ({ page }) => {
    await page.goto("/emergencia-pediatrica");
    await page.getByTestId("ped-peso").fill("11");
    await page.getByTestId("ped-calcular").click();
    await page.getByTestId("ped-aba-infusoes").click();
    await page.getByRole("button", { name: "Noradrenalina" }).click();
    await page.getByTestId("ped-inf-dose").fill("0,05");
    await page.getByTestId("ped-inf-vazao").fill("2");
    await expect(page.getByTestId("ped-inf-prescricao")).toContainText("0,83 mL");
  });

  test("modo RCP: registra choque e adrenalina", async ({ page }) => {
    await page.clock.install();
    await page.goto("/emergencia-pediatrica");
    await page.getByTestId("ped-peso").fill("11");
    await page.getByTestId("ped-calcular").click();
    await page.getByTestId("ped-iniciar-rcp").click();
    await expect(page.getByTestId("ped-modo-pcr")).toBeVisible();

    await page.getByTestId("ped-dar-adrenalina").click();
    await expect(page.getByTestId("ped-pcr-registro")).toContainText("Adrenalina 1");

    // dois minutos depois: checagem de ritmo
    await page.clock.runFor(121_000);
    await page.getByTestId("ped-ritmo-chocavel").click();
    await page.getByTestId("ped-carregar").click();
    await page.clock.runFor(3_000);
    await page.getByTestId("ped-chocar").click();
    await expect(page.getByTestId("ped-pcr-registro")).toContainText("Choque 1: 22 J");
  });
});
