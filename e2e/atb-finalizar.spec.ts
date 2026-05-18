import { test, expect } from "@playwright/test";
import { seedLocalUser } from "./fixtures/mock-edge";

/**
 * Cria um paciente "temp_" no localStorage com um ATB ativo, abre a página
 * /paciente/<id>, clica em "Finalizar" e valida que o estado salva direito.
 *
 * Usa o fallback localStorage (id começa com "temp_" pra evitar Supabase real).
 */
test.describe("Finalizar ATB", () => {
  const patientId = "temp_test_atb_001";

  test.beforeEach(async ({ page }) => {
    await seedLocalUser(page);
    await page.addInitScript((id) => {
      const paciente = {
        id,
        nome: "PACIENTE TESTE",
        leito: "L01",
        idade: "65 ANOS",
        sexo: "M",
        setor: "Clínica Médica",
        data_admissao: "2026-05-10",
        motivo_admissao: "PNEUMONIA",
        antibioticos: [
          {
            nome: "CEFTRIAXONA",
            dose: "2g",
            via: "IV",
            frequencia: "1x/dia",
            data_inicio: "2026-05-10",
          },
        ],
        laboratorios: [],
        pendencias: [],
        lista_de_problemas: [{ id: "p1", text: "PNEUMONIA" }],
      };
      localStorage.setItem("da_pacientes", JSON.stringify([paciente]));
    }, patientId);
  });

  test("clica em Finalizar, escolhe data e status, ATB fica marcado e persiste", async ({ page }) => {
    await page.goto(`/paciente/${patientId}`);

    // ATB CEFTRIAXONA visível
    await expect(page.getByText(/CEFTRIAXONA/i).first()).toBeVisible();

    // Botão Finalizar visível
    const finalizarBtn = page.getByRole("button", { name: /^finalizar$/i });
    await expect(finalizarBtn).toBeVisible();
    await finalizarBtn.click();

    // Modal abre
    await expect(page.getByRole("heading", { name: /finalizar antibiótico/i })).toBeVisible();
    await expect(page.getByText(/^CEFTRIAXONA$/)).toBeVisible();

    // Status default = Finalizado
    const finalizadoBtn = page.getByRole("button", { name: /^finalizado$/i });
    await expect(finalizadoBtn).toBeVisible();

    // Confirma
    await page.getByRole("button", { name: /^confirmar$/i }).click();

    // Toast aparece
    await expect(page.getByText(/marcado como finalizado/i)).toBeVisible({ timeout: 5_000 });

    // Botão Finalizar desaparece (ATB agora finalizado)
    await expect(finalizarBtn).not.toBeVisible();

    // Tag "Finalizado" aparece
    await expect(page.getByText(/^finalizado$/i).first()).toBeVisible();

    // Persistiu no localStorage
    const saved = await page.evaluate(() => {
      const list = JSON.parse(localStorage.getItem("da_pacientes") || "[]");
      return list[0]?.antibiotics?.[0];
    });
    expect(saved?.status).toBe("finalizado");
    expect(saved?.data_fim).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("modal pode ser cancelado sem mudar nada", async ({ page }) => {
    await page.goto(`/paciente/${patientId}`);

    await page.getByRole("button", { name: /^finalizar$/i }).click();
    await expect(page.getByRole("heading", { name: /finalizar antibiótico/i })).toBeVisible();

    await page.getByRole("button", { name: /^cancelar$/i }).click();
    await expect(page.getByRole("heading", { name: /finalizar antibiótico/i })).not.toBeVisible();

    // ATB continua ativo (botão Finalizar ainda lá)
    await expect(page.getByRole("button", { name: /^finalizar$/i })).toBeVisible();
  });
});
