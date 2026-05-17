import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:5173";

const SEED = {
  da_local_user_id: "00000000-0000-4000-8000-000000000c0c",
  da_shift_id: "temp_shift_badge",
  da_tipo_evolucao: "uti",
  da_plantao_ativo: JSON.stringify({
    id: "temp_shift_badge", data: "2026-05-16", data_formatada: "16/05/2026",
    setor: "UTI", hospital: "Hospital Badge", tipo: "uti", status: "active",
    criado_em: Date.now(),
  }),
  da_pacientes: JSON.stringify([
    { id: "temp_pb", nome: "PACIENTE BADGE", shift_id: "temp_shift_badge", setor: "UTI", leito: "U1", idade: 60, sexo: "M", motivo_admissao: "TESTE", lista_de_problemas: [], antibioticos: [], laboratorios: [], pendencias: [], status: "internado" },
  ]),
};

const results = [];
const log = (n, ok, d = "") => { results.push({ n, ok, d }); console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.evaluate((seed) => { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }, SEED);

const ROUTES_COM_BADGE = [
  { url: "/dashboard", label: "dashboard", silent: false },
  { url: "/paciente/temp_pb", label: "paciente", silent: false },
  { url: "/evolucao/temp_pb", label: "evolucao", silent: true },
  { url: "/prescricao/temp_pb", label: "prescricao", silent: true },
  { url: "/passagem", label: "passagem", silent: true },
];

try {
  for (const r of ROUTES_COM_BADGE) {
    await page.goto(`${BASE}${r.url}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    // Badge tem texto "UTI · 16/05"
    const badge = await page.locator("button").filter({ hasText: /UTI/ }).filter({ hasText: /16\/05/ }).count();
    log(`Badge.${r.label} ShiftBadge presente`, badge > 0, `count=${badge}`);
  }

  // Click no badge do dashboard abre dropdown
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.locator("button").filter({ hasText: /UTI/ }).filter({ hasText: /16\/05/ }).first().click();
  await page.waitForTimeout(300);

  log("Badge.dropdown 'Trocar plantão' aparece", await page.locator("text=Trocar plantão").count() > 0);
  log("Badge.dropdown 'Ver arquivados' aparece", await page.locator("text=Ver arquivados").count() > 0);
  log("Badge.dropdown 'Encerrar plantão' aparece", await page.locator("text=Encerrar plantão").count() > 0);

  // Click "Trocar plantão" navega pra /plantoes
  await page.locator("text=Trocar plantão").first().click();
  await page.waitForTimeout(1000);
  log("Badge.click 'Trocar plantão' navega para /plantoes", page.url().includes("/plantoes"), `url=${page.url()}`);
} catch (e) {
  log("Badge falha geral", false, e.message);
  console.log(e);
}

await browser.close();
const passed = results.filter(r => r.ok).length;
const failed = results.filter(r => !r.ok).length;
console.log(`\n${passed} passou(aram), ${failed} falhou(aram).`);
process.exit(failed === 0 ? 0 : 1);
