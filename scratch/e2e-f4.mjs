import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:5173";
const PATIENT_ID = "temp_p_f4";

const SEED = {
  da_local_user_id: "00000000-0000-4000-8000-000000000044",
  da_local_user_name: "Doutor F4",
  da_shift_id: "temp_shift_f4",
  da_tipo_evolucao: "enfermaria_clinica",
  da_plantao_ativo: JSON.stringify({ id: "temp_shift_f4", data: "2026-05-16", data_formatada: "16/05/2026", setor: "ENFERMARIA", hospital: "Hospital", status: "active", criado_em: Date.now() }),
  da_pacientes: JSON.stringify([
    {
      id: PATIENT_ID,
      nome: "PACIENTE F4 ORIGINAL",
      leito: "L10",
      idade: 62,
      sexo: "M",
      setor: "ENFERMARIA",
      data_admissao: "2026-05-12",
      motivo_admissao: "PNEUMONIA",
      lista_de_problemas: [{ id: "x", text: "Pneumonia" }],
      antibioticos: [{ id: "a1", nome: "CEFTRIAXONA", dose: "1g", via: "IV", frequencia: "12/12h", dataInicio: "2026-05-12" }],
      pendencias: [{ id: "p1", text: "Aguarda cultura" }],
      status: "internado",
    },
  ]),
  da_evolucoes: JSON.stringify([
    { id: "ev_dia_2", patient_id: PATIENT_ID, shift_id: "temp_shift_f4", content: "EVOLUCAO DIA 2 — PACIENTE EM MELHORA", created_at: "2026-05-15T08:00:00.000Z" },
    { id: "ev_dia_1", patient_id: PATIENT_ID, shift_id: "temp_shift_f4", content: "EVOLUCAO DIA 1 — ADMISSAO", created_at: "2026-05-14T08:00:00.000Z" },
    { id: "ev_dia_0", patient_id: PATIENT_ID, shift_id: "temp_shift_f4", content: "EVOLUCAO INICIAL — ANAMNESE", created_at: "2026-05-12T19:00:00.000Z" },
  ]),
};

const results = [];
const log = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.evaluate((seed) => {
  for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
}, SEED);

try {
  await page.goto(`${BASE}/paciente/${PATIENT_ID}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const body = await page.locator("body").innerText();
  console.log("  DEBUG body[:300]:", body.slice(0, 300));

  // 1) Header tem badge de gravidade
  const gravBadge = await page.locator("text=/CRÍTICO|GRAVE|MODERADO|LEVE/").first();
  await gravBadge.waitFor({ timeout: 5000 });
  log("F4.a Badge de gravidade renderiza", true);

  // 2) Barra de ações primárias
  const evoluirBtn = page.getByRole("button", { name: /^EVOLUIR$/i });
  log("F4.b Botão EVOLUIR na barra primária", (await evoluirBtn.count()) > 0);
  const prescBtn = page.getByRole("button", { name: /^PRESCREVER$/i });
  log("F4.c Botão PRESCREVER na barra primária", (await prescBtn.count()) > 0);
  const anexarBtn = page.getByRole("button", { name: /^ANEXAR DOC$/i });
  log("F4.d Botão ANEXAR DOC na barra primária", (await anexarBtn.count()) > 0);

  // 3) Timeline mostra todas as 3 evoluções
  const evNodes = await page.locator("text=/EVOLUCAO (INICIAL|DIA \\d)/").count();
  log("F4.e Timeline mostra todas as evoluções", evNodes >= 3, `count=${evNodes}`);

  // 4) Botão "USAR COMO BASE" em cada evolução
  const usarBaseBtns = page.getByRole("button", { name: /USAR COMO BASE/i });
  log("F4.f Botões 'USAR COMO BASE' aparecem", (await usarBaseBtns.count()) >= 3, `count=${await usarBaseBtns.count()}`);

  // 5) Clicar USAR COMO BASE da mais recente navega pra /evolucao/?from=
  await usarBaseBtns.first().click();
  await page.waitForURL(/\/evolucao\/[^/]+\?from=/, { timeout: 5000 });
  log("F4.g Click 'USAR COMO BASE' navega com ?from=", true, `url=${page.url()}`);

  // 6) Voltar para o paciente e testar edição inline
  await page.goto(`${BASE}/paciente/${PATIENT_ID}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  // Edição inline do nome: click no h1 → input
  const nomeHeading = page.locator("h1:has-text('PACIENTE F4 ORIGINAL')");
  await nomeHeading.click();
  await page.waitForTimeout(200);

  const editInput = page.locator('input[aria-label="Editar nome do paciente"]');
  log("F4.h Click no nome abre input de edição", (await editInput.count()) > 0);

  await editInput.fill("PACIENTE F4 EDITADO");
  await editInput.press("Enter");
  await page.waitForTimeout(800);

  const updated = await page.locator("h1:has-text('PACIENTE F4 EDITADO')").count();
  log("F4.i Edição inline persiste no header", updated > 0);

  const stored = await page.evaluate((id) => {
    const arr = JSON.parse(localStorage.getItem("da_pacientes") || "[]");
    return arr.find((p) => p.id === id);
  }, PATIENT_ID);
  log("F4.j Edição inline persiste no localStorage",
      stored?.nome === "PACIENTE F4 EDITADO" || stored?.name === "PACIENTE F4 EDITADO",
      `nome=${stored?.nome} name=${stored?.name}`);

  // Edição do leito: click no botão LEITO L10
  const leitoBtn = page.locator("button:has-text('LEITO L10')").or(page.locator("button:has-text('LEITO')"));
  if ((await leitoBtn.count()) > 0) {
    await leitoBtn.first().click();
    await page.waitForTimeout(200);
    const leitoInput = page.locator('input[aria-label="Editar leito"]');
    if ((await leitoInput.count()) > 0) {
      await leitoInput.fill("L42");
      await leitoInput.press("Enter");
      await page.waitForTimeout(500);
      const leitoUpdated = await page.locator("text=LEITO L42").count();
      log("F4.k Edição inline do leito funciona", leitoUpdated > 0);
    } else {
      log("F4.k Edição inline do leito funciona", false, "input não apareceu");
    }
  }
} catch (e) {
  log("F4 falha geral", false, e.message);
  console.log(e);
}

await browser.close();
const passed = results.filter(r => r.ok).length;
const failed = results.filter(r => !r.ok).length;
console.log(`\n${passed} passou(aram), ${failed} falhou(aram).`);
process.exit(failed === 0 ? 0 : 1);
