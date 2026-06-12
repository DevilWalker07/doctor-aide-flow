import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:5173";

const SEED = {
  da_local_user_id: "00000000-0000-4000-8000-000000000777",
  da_shift_id: "temp_shift_explore",
  da_tipo_evolucao: "enfermaria_clinica",
  da_plantao_ativo: JSON.stringify({ id: "temp_shift_explore", data: "2026-05-16", data_formatada: "16/05/2026", setor: "ENFERMARIA", hospital: "Hospital", status: "active", criado_em: Date.now() }),
  da_pacientes: JSON.stringify([
    { id: "temp_pe", nome: "PACIENTE EXPLORE", leito: "L01", idade: 60, sexo: "M", setor: "ENFERMARIA", data_admissao: "2026-05-12", motivo_admissao: "TESTE", lista_de_problemas: [{ id: "x", text: "TESTE" }], antibioticos: [], laboratorios: [], pendencias: [], status: "internado" },
  ]),
};

// Rotas com $id usam temp_pe; $jobId usa temp_job; $bulkJobId usa temp_bulk
const ROUTES = [
  "/",
  "/login",
  "/dashboard",
  "/iniciar-plantao",
  "/tipo",
  "/upload-ia",
  "/upload-ia?modo=lote",
  "/cadastro",
  "/cadastro-manual",
  "/novo-paciente",
  "/admissao-nova",
  "/paciente-internado",
  "/paciente/temp_pe",
  "/paciente.temp",
  "/evolucao/temp_pe",
  "/evolucao/temp_pe/historico",
  "/prescricao/temp_pe",
  "/encaminhamento/temp_pe",
  "/passagem",
  "/processando/temp_job",
  "/passagem-massa/temp_bulk",
  "/revisar-extracao",
  "/round",
  "/configuracoes",
  "/recuperar-senha",
  "/nova-senha",
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.evaluate((seed) => { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }, SEED);

const broken = [];
for (const route of ROUTES) {
  try {
    let errored = false;
    const handler = (msg) => { if (msg.type() === "error") errored = true; };
    page.on("console", handler);
    await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 8000 });
    await page.waitForTimeout(700);
    const body = await page.locator("body").innerText();
    const hasError = body.includes("Something went wrong") || body.includes("Rendered more hooks");
    page.off("console", handler);
    if (hasError) {
      const snippet = body.slice(0, 150).replace(/\n/g, " | ");
      broken.push({ route, snippet });
      console.log(`❌ ${route}\n   → ${snippet}`);
    } else {
      console.log(`✅ ${route}`);
    }
  } catch (e) {
    broken.push({ route, snippet: `EXCEPTION ${e.message}` });
    console.log(`⚠️  ${route} — ${e.message}`);
  }
}

console.log(`\n${ROUTES.length - broken.length}/${ROUTES.length} rotas renderizam sem erro. ${broken.length} quebradas.`);
if (broken.length) {
  console.log("\nROTAS QUEBRADAS:");
  for (const b of broken) console.log(`  - ${b.route}`);
}
await browser.close();
process.exit(broken.length === 0 ? 0 : 1);
