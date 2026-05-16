import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:5173";

const SEED = {
  da_local_user_id: "00000000-0000-4000-8000-000000000001",
  da_shift_id: "temp_shift_e2e",
  da_tipo_evolucao: "enfermaria_clinica",
  da_plantao_ativo: JSON.stringify({ id: "temp_shift_e2e", data: "2026-05-16", setor: "ENFERMARIA", hospital: "Hospital E2E", status: "active", criado_em: Date.now() }),
  // Extração com nome esperado pra cair no /revisar-extracao
  da_extracao_resultado: JSON.stringify({
    fileName: "documento.pdf",
    engine: "openai-text",
    markdown: "",
    extracted: {
      nome: "PACIENTE ATB TESTE",
      idade: 60,
      sexo: "M",
      leito: "L42",
      setor: "ENFERMARIA",
      data_admissao: "2026-05-12",
      motivo_admissao: "PNEUMONIA",
      hda: "Tosse 5 dias",
      lista_de_problemas: ["Pneumonia"],
      antibioticos: [],
      medicacoes: [],
      laboratorios: [],
      exame_fisico_detalhado: {},
      condutas: [],
      pendencias: [],
      alertas: [],
    },
    createdAt: new Date().toISOString(),
  }),
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
  // sessionStorage também (revisar-extracao tenta ambos)
  for (const [k, v] of Object.entries(seed)) sessionStorage.setItem(k, v);
}, SEED);

await page.goto(`${BASE}/revisar-extracao`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

try {
  // Navegar pra aba de antibióticos
  await page.locator("text=Antibióticos").first().click();
  await page.waitForTimeout(500);

  // 1) Painel de "ADICIONAR ROTINEIRO" aparece
  const panel = page.locator("text=ADICIONAR ROTINEIRO");
  log("F2.a Painel 'ADICIONAR ROTINEIRO' renderiza", (await panel.count()) > 0);

  // 2) Os 14 ATB rotineiros aparecem como chips
  const chipsCount = await page.locator("button:has-text('+ ')").count();
  log("F2.b 14 chips de ATB rotineiros aparecem", chipsCount >= 14, `count=${chipsCount}`);

  // 3) Gentamicina está na lista
  const genta = page.locator("button:has-text('GENTAMICINA')");
  log("F2.c GENTAMICINA presente", (await genta.count()) > 0);

  // 4) Tigeciclina foi removida
  const tige = page.locator("text=TIGECICLINA");
  log("F2.d TIGECICLINA removida", (await tige.count()) === 0);

  // 5) Clicar em CEFTRIAXONA adiciona ao paciente
  await page.locator("button:has-text('+ CEFTRIAXONA')").first().click();
  await page.waitForTimeout(400);
  const addedCard = await page.locator(".bg-slate-50:has-text('CEFTRIAXONA')").count();
  log("F2.e Clicar em chip adiciona ATB ao paciente", addedCard > 0);

  // 6) Dose vem pré-preenchida (1g)
  const doseInput = page.locator("input[value='1G']").or(page.locator("input[value='1g']"));
  log("F2.f Dose pré-preenchida (1g)", (await doseInput.count()) > 0);

  // 7) Autocomplete: digitar "VANCO" sugere VANCOMICINA
  // Adicionar ATB manual primeiro
  await page.locator("text=ADICIONAR ATB MANUAL").click();
  await page.waitForTimeout(300);
  const nomeInputs = page.locator("input[placeholder*='Digite ou escolha']");
  const lastNome = nomeInputs.last();
  await lastNome.click();
  await lastNome.fill("VANCO");
  await page.waitForTimeout(400);

  const sugestao = page.locator("text=VANCOMICINA").first();
  log("F2.g Autocomplete sugere VANCOMICINA pra 'VANCO'", (await sugestao.count()) > 0);

  // 8) Clicar na sugestão preenche o nome canônico
  await page.locator("button:has(p:text('VANCOMICINA'))").first().click({ trial: false }).catch(() => null);
  await page.waitForTimeout(300);
  const lastValue = await lastNome.inputValue();
  log("F2.h Selecionar sugestão preenche nome canônico", lastValue === "VANCOMICINA", `valor=${lastValue}`);

  // 9) PIPERACILINA + TAZOBACTAM aparece (com label abreviado PIP-TAZO no chip)
  const pipChip = page.locator("button:has-text('PIP-TAZO')");
  log("F2.i Chip PIP-TAZO (Piperacilina+Tazobactam) presente", (await pipChip.count()) > 0);
} catch (e) {
  log("F2 falha geral", false, e.message);
}

await browser.close();

const passed = results.filter(r => r.ok).length;
const failed = results.filter(r => !r.ok).length;
console.log(`\n${passed} passou(aram), ${failed} falhou(aram).`);
process.exit(failed === 0 ? 0 : 1);
