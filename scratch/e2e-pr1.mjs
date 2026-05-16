import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:5174";
const PATIENT_ID = "temp_e2e_test";

const localStorageSeed = {
  da_user_id: "user_e2e_test",
  da_shift_id: "temp_shift_e2e",
  da_tipo_evolucao: "enfermaria_clinica",
  da_plantao_ativo: JSON.stringify({ date: "2026-05-16", sector: "ENFERMARIA" }),
  da_pacientes: JSON.stringify([
    {
      id: PATIENT_ID,
      nome: "PACIENTE TESTE E2E",
      leito: "L99",
      data_admissao: "2026-05-10",
      pendencias: [{ text: "Conferir hemograma" }],
      antibioticos: [{ nome: "CEFTRIAXONA", dataInicio: "2026-05-12" }],
      laboratorios: [{ valor: "HB 12 | LEUCO 10000 | PCR 5" }],
      exame_fisico: { modo: "PSV", fio2: 40, peep: 8, vmFr: 18 },
    },
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
page.on("console", (m) => {
  if (m.type() === "error") console.log("  [console.error]", m.text().slice(0, 200));
});

// Bloquear chamadas ao backend de IA (não queremos depender do Railway)
await page.route("**/api/ai/**", (route) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ evolution_text: "EVOLUCAO MOCK GERADA PELA IA" }),
  })
);

// Seed localStorage antes de qualquer navegação SPA
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.evaluate((seed) => {
  for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
}, localStorageSeed);

// Navegar pra rota de evolução
await page.goto(`${BASE}/evolucao/${PATIENT_ID}`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);

// ========== TESTE 1: dropdown de template existe e troca de valor ==========
try {
  const select = page.locator('select[aria-label="Tipo de unidade para o modelo de evolução"]');
  await select.waitFor({ timeout: 5000 });
  const initial = await select.inputValue();
  log("3.1.a Dropdown de template renderiza", true, `valor inicial=${initial}`);

  await select.selectOption("uti");
  await page.waitForTimeout(300);
  const after = await select.inputValue();
  log("3.1.b Dropdown muda para UTI", after === "uti", `valor=${after}`);

  // Painel UTI específico aparece (MODO VM, FiO2, PEEP, FR)
  const utiPanel = await page.locator("text=MODO VM").count();
  log("3.1.c Painel UTI renderiza após trocar tipo", utiPanel > 0, `MODO VM count=${utiPanel}`);

  // Persistência por paciente
  const persisted = await page.evaluate((id) => localStorage.getItem(`da_evol_tipo_${id}`), PATIENT_ID);
  log("3.1.d Tipo persistido em localStorage por paciente", persisted === "uti", `da_evol_tipo_${PATIENT_ID}=${persisted}`);

  // Volta pra enfermaria clínica pros próximos testes
  await select.selectOption("enfermaria_clinica");
  await page.waitForTimeout(200);
} catch (e) {
  log("3.1 Dropdown de template", false, e.message);
}

// ========== TESTE 2: modal de sobrescrita ==========
try {
  const textarea = page.locator("textarea").first();
  await textarea.fill("TEXTO PRE EXISTENTE NO TEXTAREA");
  await page.waitForTimeout(200);

  // Clicar GERAR
  await page.getByRole("button", { name: /GERAR EVOLU/i }).click();
  await page.waitForTimeout(500);

  // Modal deve aparecer
  const modalTitle = await page.locator("text=Já existe texto no campo").count();
  log("3.2.a Modal de sobrescrita aparece", modalTitle > 0);

  // Botão "Anexar abaixo" mantém o texto antigo e junta o novo
  await page.getByRole("button", { name: /Anexar abaixo/i }).click();
  await page.waitForTimeout(800); // tempo do fetch interceptado responder

  const valAfterAppend = await textarea.inputValue();
  const appended = valAfterAppend.includes("TEXTO PRE EXISTENTE") && valAfterAppend.includes("EVOLUCAO MOCK GERADA");
  log("3.2.b Anexar mantém texto antigo + IA", appended, `tamanho=${valAfterAppend.length}`);

  // Limpa e clica GERAR sem texto: NÃO deve abrir modal
  await textarea.fill("");
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: /GERAR EVOLU/i }).click();
  await page.waitForTimeout(500);
  const modalStillOpen = await page.locator("text=Já existe texto no campo").count();
  log("3.2.c Sem texto, GERAR não abre modal", modalStillOpen === 0);
  await page.waitForTimeout(800);
} catch (e) {
  log("3.2 Modal de sobrescrita", false, e.message);
}

// ========== TESTE 3: auto-save de rascunho ==========
try {
  const textarea = page.locator("textarea").first();
  await textarea.fill("RASCUNHO TESTE QUE NAO FOI SALVO");
  await page.waitForTimeout(1500); // > debounce 1000ms

  const stored = await page.evaluate(
    (id) => localStorage.getItem(`da_evol_rascunho_${id}`),
    PATIENT_ID
  );
  const hasDraft = !!stored && stored.includes("RASCUNHO TESTE");
  log("3.3.a Rascunho salvo em localStorage após debounce", hasDraft, stored ? `len=${stored.length}` : "vazio");

  // Recarrega a página
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const bannerCount = await page.locator("text=Rascunho não salvo encontrado").count();
  log("3.3.b Banner de rascunho aparece após reload", bannerCount > 0);

  // Clicar Restaurar
  await page.getByRole("button", { name: /^Restaurar$/i }).click();
  await page.waitForTimeout(500);

  const ta2 = page.locator("textarea").first();
  const restored = await ta2.inputValue();
  log("3.3.c Restaurar volta o texto", restored.includes("RASCUNHO TESTE"), `len=${restored.length}`);

  // Banner deve sumir
  const bannerAfter = await page.locator("text=Rascunho não salvo encontrado").count();
  log("3.3.d Banner some após restaurar", bannerAfter === 0);

  // Descartar: setar texto, esperar salvar, reload, clicar Descartar
  await ta2.fill("OUTRO RASCUNHO");
  await page.waitForTimeout(1500);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /^Descartar$/i }).click();
  await page.waitForTimeout(300);
  const draftGone = await page.evaluate(
    (id) => localStorage.getItem(`da_evol_rascunho_${id}`),
    PATIENT_ID
  );
  log("3.3.e Descartar remove rascunho do storage", draftGone === null, `valor=${draftGone}`);
} catch (e) {
  log("3.3 Auto-save de rascunho", false, e.message);
}

await browser.close();

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${passed} passou(aram), ${failed} falhou(aram).`);
process.exit(failed === 0 ? 0 : 1);
