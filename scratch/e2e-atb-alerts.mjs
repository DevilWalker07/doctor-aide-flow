import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:5173";
const SHIFT_ID = "shift_atb_f1";

const today = new Date();
const dateMinusDays = (d) => {
  const dt = new Date(today);
  dt.setDate(dt.getDate() - d);
  return dt.toISOString().slice(0, 10);
};

const SEED = {
  da_local_user_id: "00000000-0000-4000-8000-000000000f01",
  da_shift_id: SHIFT_ID,
  da_tipo_evolucao: "uti",
  da_atb_day_rule: "D0",
  da_plantao_ativo: JSON.stringify({
    id: SHIFT_ID, data: today.toISOString().slice(0, 10),
    data_formatada: `${today.getDate().toString().padStart(2, "0")}/${(today.getMonth() + 1).toString().padStart(2, "0")}/${today.getFullYear()}`,
    setor: "UTI", hospital: "H", tipo: "uti", status: "active", criado_em: Date.now(),
  }),
  da_pacientes: JSON.stringify([
    {
      id: "p_ok", nome: "PACIENTE OK", shift_id: SHIFT_ID, setor: "UTI", leito: "U1",
      idade: 60, sexo: "M", motivo_admissao: "PNEU",
      antibioticos: [{ nome: "CEFTRIAXONA", dose: "1g", via: "IV", frequencia: "12/12h", dataInicio: dateMinusDays(2) }],
      lista_de_problemas: [], laboratorios: [], pendencias: [], status: "internado",
    },
    {
      id: "p_amarelo", nome: "PACIENTE AMARELO", shift_id: SHIFT_ID, setor: "UTI", leito: "U2",
      idade: 70, sexo: "F", motivo_admissao: "PNEU",
      antibioticos: [{ nome: "VANCOMICINA", dose: "1g", via: "IV", frequencia: "12/12h", dataInicio: dateMinusDays(5) }],
      lista_de_problemas: [], laboratorios: [], pendencias: [], status: "internado",
    },
    {
      id: "p_vermelho", nome: "PACIENTE VERMELHO", shift_id: SHIFT_ID, setor: "UTI", leito: "U3",
      idade: 80, sexo: "F", motivo_admissao: "SEPSE",
      antibioticos: [{ nome: "MEROPENEM", dose: "1g", via: "IV", frequencia: "8/8h", dataInicio: dateMinusDays(8) }],
      lista_de_problemas: [], laboratorios: [], pendencias: [], status: "internado",
    },
  ]),
};

const results = [];
const log = (n, ok, d = "") => { results.push({ n, ok, d }); console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
let loops = 0;
page.on("console", (m) => { if (m.type() === "error" && m.text().includes("Maximum update")) loops++; });
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.evaluate((seed) => { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }, SEED);

try {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  log("F1.a Banner agregado no dashboard", await page.locator("text=paciente(s) com ATB para reavaliar").count() > 0);
  log("F1.b PACIENTE AMARELO listado no banner", await page.locator(".bg-red-50 :text('PACIENTE AMARELO')").count() > 0);
  log("F1.c PACIENTE VERMELHO listado no banner", await page.locator(".bg-red-50 :text('PACIENTE VERMELHO')").count() > 0);
  log("F1.d PACIENTE OK NÃO listado no banner", await page.locator(".bg-red-50 :text('PACIENTE OK')").count() === 0);
  log("F1.e Card OK mostra 'ATB D2' (azul)", await page.locator("text=/ATB D2/").count() > 0);
  log("F1.f Card AMARELO mostra '⚠ ATB D5'", await page.locator("text=/⚠ ATB D5/").count() > 0);
  log("F1.g Card VERMELHO mostra '⚠ ATB D8'", await page.locator("text=/⚠ ATB D8/").count() > 0);

  await page.goto(`${BASE}/paciente/p_vermelho`, { waitUntil: "networkidle" });
  // espera até a página carregar de fato (textarea/cards/header)
  await page.waitForFunction(() => document.body.innerText.includes("PACIENTE VERMELHO"), { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1000);
  log("F1.h Banner no /paciente vermelho aparece (MEROPENEM)", await page.locator("text=MEROPENEM").count() > 0);
  log("F1.i Botão 'Registrar reavaliação' visível", await page.locator("text=Registrar reavaliação").count() > 0);

  await page.locator("text=Registrar reavaliação").first().click();
  await page.waitForTimeout(1500);
  const reaval = await page.evaluate(() => JSON.parse(localStorage.getItem("da_atb_reavaliacoes") || "{}"));
  log("F1.j Reavaliação gravada", Object.keys(reaval).some(k => k.includes("MEROPENEM")));
  // banner ATB desaparece (MEROPENEM em banner some, mas o nome pode aparecer em outros lugares)
  log("F1.k Banner ATB some após reavaliar",
      await page.locator(".bg-red-100.border-red-300, .bg-amber-100.border-amber-300").count() === 0);

  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  log("F1.l Banner dashboard sem VERMELHO depois da reavaliação",
      await page.locator(".bg-red-50 :text('PACIENTE VERMELHO')").count() === 0
      && await page.locator(".bg-red-50 :text('PACIENTE AMARELO')").count() > 0);

  log("F1.m Sem loops infinitos", loops === 0, `loops=${loops}`);
} catch (e) {
  log("F1 falha geral", false, e.message);
}

await browser.close();
const passed = results.filter(r => r.ok).length;
const failed = results.filter(r => !r.ok).length;
console.log(`\n${passed} passou(aram), ${failed} falhou(aram).`);
process.exit(failed === 0 ? 0 : 1);
