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

  test("RCP começa sem peso e o peso entra depois", async ({ page }) => {
    await page.goto("/emergencia-pediatrica");
    await page.getByTestId("ped-iniciar-rcp").click();
    await expect(page.getByTestId("ped-modo-pcr")).toBeVisible();
    await expect(page.getByTestId("ped-pcr-peso")).toContainText("Peso?");
    await page.getByTestId("ped-pcr-peso").click();
    const gaveta = page.getByRole("dialog", { name: "Peso e idade" });
    await gaveta.getByTestId("ped-peso").fill("11");
    await gaveta.getByTestId("ped-calcular").click();
    await expect(page.getByTestId("ped-pcr-peso")).toContainText("11 kg");
    await expect(page.getByTestId("ped-dar-adrenalina")).toContainText("1,1 mL");
  });

  test("intubação passa para compressões contínuas e registra", async ({ page }) => {
    await page.goto("/emergencia-pediatrica");
    await page.getByTestId("ped-peso").fill("11");
    await page.getByTestId("ped-anos").fill("1");
    await page.getByTestId("ped-calcular").click();
    await page.getByTestId("ped-iniciar-rcp").click();
    await page.getByTestId("ped-acao-intubacao").click();
    await page.getByTestId("ped-intubado").click();
    await expect(page.getByTestId("ped-pcr-registro")).toContainText("tubo 3,5 com cuff");
    await expect(
      page.getByRole("button", { name: "Via aérea avançada", pressed: true }),
    ).toBeVisible();
  });

  test("RCP sobrevive a recarregar a página", async ({ page }) => {
    await page.goto("/emergencia-pediatrica");
    await page.evaluate(() => localStorage.removeItem("da_rcp_sessao"));
    await page.getByTestId("ped-peso").fill("11");
    await page.getByTestId("ped-calcular").click();
    await page.getByTestId("ped-iniciar-rcp").click();
    await page.getByTestId("ped-dar-adrenalina").click();

    await page.reload();
    await expect(page.getByTestId("ped-rcp-salva")).toContainText("RCP em andamento");
    await page.getByTestId("ped-retomar-rcp").click();
    const registro = page.getByTestId("ped-pcr-registro");
    await expect(registro).toContainText("Adrenalina 1");
    await expect(registro).toContainText("RCP retomada");
    await expect(page.getByTestId("ped-pcr-peso")).toContainText("11 kg");
  });

  test("encerrar gera o registro em PDF com a equipe", async ({ page }) => {
    await page.goto("/emergencia-pediatrica");
    await page.evaluate(() => localStorage.removeItem("da_rcp_sessao"));
    await page.getByTestId("ped-peso").fill("11");
    await page.getByTestId("ped-calcular").click();
    await page.getByTestId("ped-iniciar-rcp").click();
    await page.getByTestId("ped-acao-equipe").click();
    await page.getByTestId("ped-equipe-lider").fill("Dra. Teste");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Encerrar RCP" }).click();
    await page.getByTestId("ped-pcr-sair").click();
    await expect(page.getByTestId("ped-pcr-fim")).toContainText("Encerrada sem RCE");

    const download = page.waitForEvent("download");
    await page.getByTestId("ped-pcr-pdf").click();
    expect((await download).suggestedFilename()).toMatch(/^rcp-pediatrica_.*\.pdf$/);
  });

  test("peso estimado muda com o sexo: menino 2 × idade + 9, menina 2 × idade + 8", async ({
    page,
  }) => {
    await page.goto("/emergencia-pediatrica");
    await page.getByTestId("ped-anos").fill("3");
    await page.getByTestId("ped-sexo-M").click();
    await expect(page.getByTestId("ped-usar-estimado")).toContainText("15 kg");
    await page.getByTestId("ped-sexo-F").click();
    await expect(page.getByTestId("ped-usar-estimado")).toContainText("14 kg");
    await page.getByTestId("ped-usar-estimado").click();
    await expect(page.getByTestId("ped-peso")).toHaveValue("14");
  });

  test("aba de intubação mostra tubo com e sem cuff e as duas lâminas", async ({ page }) => {
    await page.goto("/emergencia-pediatrica");
    await page.getByTestId("ped-peso").fill("20");
    await page.getByTestId("ped-anos").fill("6");
    await page.getByTestId("ped-calcular").click();
    await page.getByTestId("ped-aba-iot").click();
    await expect(page.getByTestId("iot-cuff")).toContainText("5");
    await expect(page.getByTestId("iot-sem-cuff")).toContainText("5,5");
    await expect(page.getByTestId("iot-lamina-reta")).toContainText("2");
    await expect(page.getByTestId("iot-lamina-curva")).toContainText("2");
  });

  test("criança e aba voltam depois de recarregar; nova criança limpa", async ({ page }) => {
    await page.goto("/emergencia-pediatrica");
    await page.getByTestId("ped-peso").fill("11");
    await page.getByTestId("ped-calcular").click();
    await page.getByTestId("ped-aba-choque").click();
    await page.reload();
    await expect(page.getByTestId("ped-paciente-chip")).toContainText("11 kg");
    await expect(page.getByTestId("ped-aba-choque")).toHaveAttribute("aria-current", "page");
    await page.getByTestId("ped-nova-crianca").click();
    await expect(page.getByTestId("ped-peso")).toHaveValue("");
  });

  test("Hs e Ts: tamponamento guia a pericardiocentese e registra", async ({ page }) => {
    await page.goto("/emergencia-pediatrica");
    await page.getByTestId("ped-peso").fill("11");
    await page.getByTestId("ped-calcular").click();
    await page.getByTestId("ped-iniciar-rcp").click();
    await page.getByRole("button", { name: /Causas reversíveis/ }).click();
    await page.getByTestId("ped-hipotese-tamponamento").check();
    await expect(page.getByTestId("ped-proc-pericardiocentese")).toBeVisible();
    await page.getByTestId("ped-proc-feito-pericardiocentese").click();
    await page.keyboard.press("Escape");
    const registro = page.getByTestId("ped-pcr-registro");
    await expect(registro).toContainText("Hipótese: Tamponamento cardíaco");
    await expect(registro).toContainText("pericardiocentese subxifoide realizada");
  });

  test("Hs e Ts: toxinas lista antídotos com dose pelo peso", async ({ page }) => {
    await page.goto("/emergencia-pediatrica");
    await page.getByTestId("ped-peso").fill("11");
    await page.getByTestId("ped-calcular").click();
    await page.getByTestId("ped-iniciar-rcp").click();
    await page.getByRole("button", { name: /Causas reversíveis/ }).click();
    await page.getByTestId("ped-conduta-toxinas").click();
    const tox = page.getByTestId("ped-causa-toxinas");
    await expect(tox).toContainText("Opioides");
    await expect(tox).toContainText("Naloxona");
    await expect(tox).toContainText("1,1 mg");
  });

  test("voltar do celular fecha a gaveta e não sai da RCP", async ({ page }) => {
    await page.goto("/emergencia-pediatrica");
    await page.getByTestId("ped-peso").fill("11");
    await page.getByTestId("ped-calcular").click();
    await page.getByTestId("ped-iniciar-rcp").click();
    await page.getByTestId("ped-acao-intubacao").click();
    await expect(page.getByRole("dialog", { name: "Intubação" })).toBeVisible();

    await page.goBack();
    await expect(page.getByRole("dialog", { name: "Intubação" })).toHaveCount(0);
    await expect(page.getByTestId("ped-modo-pcr")).toBeVisible();

    await page.goBack();
    await expect(page.getByTestId("ped-modo-pcr")).toBeVisible();
    await expect(page.getByTestId("ped-pcr-sair")).toBeVisible();
    await expect(page).toHaveURL(/emergencia-pediatrica/);
  });

  test("atalho ?rcp=1 abre direto na RCP", async ({ page }) => {
    await page.goto("/emergencia-pediatrica?rcp=1");
    await expect(page.getByTestId("ped-modo-pcr")).toBeVisible();
    await expect(page).not.toHaveURL(/rcp=1/);
  });

  test("busca única: droga com dose, conduta e seção", async ({ page }) => {
    await page.goto("/emergencia-pediatrica");
    await page.getByTestId("ped-peso").fill("11");
    await page.getByTestId("ped-calcular").click();

    await page.getByTestId("ped-abrir-busca").click();
    await page.getByTestId("busca-campo").fill("esmeron");
    await expect(page.getByTestId("busca-resultados")).toContainText("Rocurônio");
    await expect(page.getByTestId("busca-resultados")).toContainText("1,1");

    await page.getByTestId("busca-campo").fill("pericardiocentese");
    await page.getByTestId("busca-causa-tamponamento").click();
    await expect(page.getByTestId("ped-proc-pericardiocentese")).toBeVisible();
    await page.getByRole("button", { name: "Voltar à busca" }).click();

    await page.getByTestId("busca-campo").fill("tubo");
    await page.getByTestId("busca-secao-iot").click();
    await expect(page.getByTestId("ped-iot")).toBeVisible();
  });
});
