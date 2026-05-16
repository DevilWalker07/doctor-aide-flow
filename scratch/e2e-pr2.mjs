import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:5174";
const PATIENT_ID = "temp_e2e_test_pr2";
const BASE_EVOL_ID = "evol_local_base_xyz";

const localStorageSeed = {
  da_user_id: "user_e2e_test",
  da_shift_id: "temp_shift_e2e",
  da_tipo_evolucao: "enfermaria_clinica",
  da_plantao_ativo: JSON.stringify({ date: "2026-05-16", sector: "ENFERMARIA" }),
  da_pacientes: JSON.stringify([
    {
      id: PATIENT_ID,
      nome: "PACIENTE PR2",
      leito: "L77",
      data_admissao: "2026-05-10",
      pendencias: [],
      antibioticos: [],
      laboratorios: [],
      exame_fisico: {},
    },
  ]),
  da_evolucoes: JSON.stringify([
    {
      id: BASE_EVOL_ID,
      patient_id: PATIENT_ID,
      shift_id: "temp_shift_e2e",
      content: "EVOLUCAO ANTERIOR DIA 1 — TEXTO BASE COMPLETO PARA REUSO",
      created_at: "2026-05-15T08:30:00.000Z",
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

// Mock dos endpoints de IA
let lastRefineBody = null;
await page.route("**/api/ai/gerar-evolucao", (route) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ evolution_text: "EVOLUCAO RECEM GERADA PELO MOCK" }),
  })
);
await page.route("**/api/ai/refinar-evolucao", async (route) => {
  const req = route.request();
  lastRefineBody = JSON.parse(req.postData() || "{}");
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ evolution_text: "TEXTO REFINADO PELO MOCK: ENCURTADO" }),
  });
});

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.evaluate((seed) => {
  for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
}, localStorageSeed);

// ========== TESTE 3.7: usar como base via histórico ==========
try {
  await page.goto(`${BASE}/evolucao/${PATIENT_ID}/historico`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "/tmp/historico.png", fullPage: true });
  const bodyText = await page.locator("body").innerText();
  console.log("  DEBUG body snippet:", bodyText.slice(0, 400));

  const usarBaseBtn = page.getByRole("button", { name: /USAR COMO BASE/i });
  const cnt = await usarBaseBtn.count();
  log("3.7.a Botão 'USAR COMO BASE' aparece no histórico", cnt > 0, `count=${cnt}`);

  await usarBaseBtn.first().click();
  await page.waitForURL(/\/evolucao\/[^/]+\?from=/, { timeout: 5000 });
  await page.waitForTimeout(800);

  const textarea = page.locator("textarea").first();
  const val = await textarea.inputValue();
  log("3.7.b Textarea pré-populada com texto da evolução base", val.includes("EVOLUCAO ANTERIOR DIA 1"), `len=${val.length}`);

  // Versão "DE ANTERIOR" deve aparecer no contador
  const versoesBtn = page.getByRole("button", { name: /VERSÕES/i });
  const versoesText = await versoesBtn.textContent();
  log("3.7.c Versão 'base' empilhada no contador", /\(1\)/.test(versoesText || ""), `texto=${versoesText}`);
} catch (e) {
  log("3.7 Usar como base", false, e.message);
}

// ========== TESTE 3.5: refinar com instrução ==========
try {
  const refineInput = page.getByPlaceholder(/encurte, adicione PCR/);
  await refineInput.waitFor({ timeout: 5000 });
  log("3.5.a Campo 'Refinar com instrução' renderiza", true);

  // botão desabilitado sem instrução
  const ajustarBtn = page.getByRole("button", { name: /AJUSTAR COM IA/i });
  const disabledBefore = await ajustarBtn.isDisabled();
  log("3.5.b Botão AJUSTAR desabilitado sem instrução", disabledBefore);

  await refineInput.fill("encurte para metade");
  await page.waitForTimeout(200);

  const disabledAfter = await ajustarBtn.isDisabled();
  log("3.5.c Botão AJUSTAR habilita ao escrever instrução", !disabledAfter);

  await ajustarBtn.click();
  await page.waitForTimeout(1000);

  const textarea = page.locator("textarea").first();
  const val = await textarea.inputValue();
  log("3.5.d Textarea atualizada com texto refinado", val.includes("REFINADO PELO MOCK"), `len=${val.length}`);

  // payload chegou no backend com current_text e instruction
  const payloadOk = lastRefineBody?.instruction === "encurte para metade"
    && typeof lastRefineBody?.current_text === "string"
    && lastRefineBody.current_text.length > 0;
  log("3.5.e Payload enviado ao backend tem instruction + current_text", payloadOk, `keys=${Object.keys(lastRefineBody || {}).join(",")}`);

  // campo de instrução é limpo após sucesso
  const cleared = await refineInput.inputValue();
  log("3.5.f Campo de instrução é limpo após refinar", cleared === "", `valor=${cleared}`);
} catch (e) {
  log("3.5 Refinar com instrução", false, e.message);
}

// ========== TESTE 3.6: versões locais ==========
try {
  const versoesBtn = page.getByRole("button", { name: /VERSÕES/i });
  const txt = await versoesBtn.textContent();
  // Após base + refinar = 2 versões
  log("3.6.a Contador de versões soma base + refinada", /\(2\)/.test(txt || ""), `texto=${txt}`);

  await versoesBtn.click();
  await page.waitForTimeout(400);

  const drawerHeading = await page.locator('[role="dialog"][aria-label="Versões geradas"] h2').textContent();
  log("3.6.b Drawer de versões abre", (drawerHeading || "").toUpperCase().includes("VERSÕES"), `heading=${drawerHeading}`);

  // duas versões listadas com labels diferentes
  const refinedLabel = await page.locator("text=REFINADA").count();
  const baseLabel = await page.locator("text=DE ANTERIOR").count();
  log("3.6.c Versão REFINADA listada", refinedLabel > 0);
  log("3.6.d Versão DE ANTERIOR listada", baseLabel > 0);

  // Restaurar a versão "DE ANTERIOR"
  const restoreBtns = page.getByRole("button", { name: /Restaurar/i });
  const restoreCount = await restoreBtns.count();
  // o último botão Restaurar deve ser o da versão mais antiga (DE ANTERIOR)
  await restoreBtns.nth(restoreCount - 1).click();
  await page.waitForTimeout(500);

  const textarea = page.locator("textarea").first();
  const restored = await textarea.inputValue();
  log("3.6.e Restaurar volta o texto da versão escolhida", restored.includes("EVOLUCAO ANTERIOR DIA 1"), `len=${restored.length}`);
} catch (e) {
  log("3.6 Versões locais", false, e.message);
}

await browser.close();

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${passed} passou(aram), ${failed} falhou(aram).`);
process.exit(failed === 0 ? 0 : 1);
