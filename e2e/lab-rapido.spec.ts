import { test, expect } from "@playwright/test";
import { mockEdgeFunctions, seedLocalUser } from "./fixtures/mock-edge";

test.describe("/lab-rapido — extração standalone", () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalUser(page);
  });

  test("cola texto, processa, exibe resultado formatado no padrão Dr. Luan", async ({ page }) => {
    await mockEdgeFunctions(page, {
      "lab-extractor": (body: any) => ({
        data_exame: "18/05/26",
        tipo_exame: ["hemograma", "bioquimica"],
        valores: {
          hb: 10, ht: 33, vcm: 78, hcm: 25,
          leucocitos: 14500,
          segmentados_percent: 80, bastoes_percent: 4, linfocitos_percent: 12,
          plaquetas: 220000, creatinina: 1.4, ureia: 60,
          sodio: 138, potassio: 4.2, pcr: 35,
        },
        texto_formatado:
          "-LAB (18/05/26): HB 10 | HT 33 | VCM 78 | HCM 25 | LEUCO 14.500 (às custas de 80% SEG / 4% BAST / 12% LNF) | PLQ 220.000 | CR 1.4 | UR 60 | NA 138 | K 4.2 | PCR 35",
        eas_formatado: null,
        alertas: [],
        valores_duvidosos: [],
        campos_nao_encontrados: [],
      }),
    });

    await page.goto("/lab-rapido");

    const textarea = page.getByPlaceholder(/cole aqui o texto do laudo/i);
    await textarea.fill("HEMOGRAMA 18/05/26 HB 10 HT 33 LEUCO 14500 SEG 80% BAST 4% LNF 12%");

    await page.getByRole("button", { name: /^extrair/i }).click();

    // Resultado aparece em card
    const resultado = page.locator("pre", { hasText: /^-LAB \(18\/05\/26\):/ });
    await expect(resultado).toBeVisible({ timeout: 10_000 });
    await expect(resultado).toContainText("HB 10");
    await expect(resultado).toContainText("VCM 78");
    await expect(resultado).toContainText("80% SEG");
  });

  test("erro do edge function aparece no card sem travar a UI", async ({ page }) => {
    await mockEdgeFunctions(page, {
      "lab-extractor": () => ({ error: "PDF ilegível" }),
    });

    await page.goto("/lab-rapido");
    await page.getByPlaceholder(/cole aqui o texto do laudo/i).fill("qualquer coisa");
    await page.getByRole("button", { name: /^extrair/i }).click();

    await expect(page.getByText(/erro: pdf ilegível/i)).toBeVisible({ timeout: 10_000 });
  });

  test("botão Extrair desabilitado sem texto nem arquivo", async ({ page }) => {
    await page.goto("/lab-rapido");
    await expect(page.getByRole("button", { name: /^extrair/i })).toBeDisabled();
  });
});
