import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:5173";

const results = [];
const log = (n, ok, d = "") => { results.push({ n, ok, d }); console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", () => {}); // silenciar — esperado

try {
  // 1) Rota válida não dispara ErrorPage
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  log("EB.a Rota válida não dispara ErrorPage", await page.locator("text=Algo deu errado").count() === 0);

  // 2) 404 cai em NotFound (não ErrorPage)
  await page.goto(`${BASE}/rota-inexistente-12345`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  log("EB.b 404 mostra NotFound, não ErrorPage", await page.locator("text=Página não encontrada").count() > 0);
  log("EB.c 404 não mostra ErrorPage", await page.locator("text=Algo deu errado").count() === 0);

  // 3) Rota /test-throw SEM force — renderiza placeholder
  await page.goto(`${BASE}/test-throw`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  log("EB.d Rota de teste sem force não dispara ErrorPage", await page.locator("text=Algo deu errado").count() === 0);
  log("EB.e Rota de teste sem force mostra placeholder", await page.locator("text=adicione ?force=1").count() > 0);

  // 4) Rota /test-throw?force=1 → DEVE disparar ErrorPage
  await page.goto(`${BASE}/test-throw?force=1`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  log("EB.f ?force=1 dispara ErrorPage", await page.locator("text=Algo deu errado nesta tela").count() > 0);

  // 5) ErrorPage mostra ID do erro
  log("EB.g ErrorPage tem ID do erro", await page.locator("text=/ID do erro: [A-Z0-9]+/").count() > 0);

  // 6) ErrorPage tem detalhes técnicos colapsáveis
  log("EB.h Detalhes técnicos visíveis", await page.locator("text=Detalhes técnicos").count() > 0);

  // 7) Botões de ação presentes
  log("EB.i Botão VOLTAR AO DASHBOARD", await page.locator("text=VOLTAR AO DASHBOARD").count() > 0);
  log("EB.j Botão RECARREGAR", await page.locator("text=RECARREGAR").count() > 0);
  log("EB.k Link Voltar ao início", await page.locator("text=Voltar ao início").count() > 0);

  // 8) Clicar "VOLTAR AO DASHBOARD" navega
  await page.locator('a[href="/dashboard"]').first().click();
  await page.waitForTimeout(1500);
  log("EB.l Click 'VOLTAR AO DASHBOARD' navega corretamente", !page.url().includes("test-throw") && !page.url().includes("force"));
} catch (e) {
  log("EB falha geral", false, e.message);
  console.log(e);
}

await browser.close();
const passed = results.filter(r => r.ok).length;
const failed = results.filter(r => !r.ok).length;
console.log(`\n${passed} passou(aram), ${failed} falhou(aram).`);
process.exit(failed === 0 ? 0 : 1);
