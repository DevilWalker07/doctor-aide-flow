import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:5173";
const PATIENT_ID = "temp_p_tpl";

const SEED = {
  da_local_user_id: "00000000-0000-4000-8000-000000000088",
  da_shift_id: "temp_shift_tpl",
  da_tipo_evolucao: "enfermaria_clinica",
  da_plantao_ativo: JSON.stringify({ id: "temp_shift_tpl", data: "2026-05-16", setor: "ENFERMARIA", hospital: "Hospital", status: "active", criado_em: Date.now() }),
  da_pacientes: JSON.stringify([
    { id: PATIENT_ID, nome: "PACIENTE TPL", leito: "L20", idade: 60, sexo: "M", setor: "ENFERMARIA", data_admissao: "2026-05-12", motivo_admissao: "PNEUMONIA", lista_de_problemas: [{ id: "x", text: "PAC" }], antibioticos: [], laboratorios: [], pendencias: [], status: "internado" },
  ]),
};

let lastGenBody = null;
const results = [];
const log = (n, ok, d = "") => { results.push({ n, ok, d }); console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

await page.route("**/api/ai/gerar-evolucao", async (route) => {
  lastGenBody = JSON.parse(route.request().postData() || "{}");
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ evolution_text: "TEXTO GERADO DE TESTE" }) });
});

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.evaluate((seed) => { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }, SEED);

try {
  await page.goto(`${BASE}/evolucao/${PATIENT_ID}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  // 1) Select de modelos com optgroups
  const select = page.locator('select[aria-label="Modelo de evolução"]');
  await select.waitFor({ timeout: 5000 });
  log("Tpl.a Select de modelo renderiza", true);

  // 2) Contagem de optgroups e opções (13 templates esperados)
  const optionsCount = await select.locator("option").count();
  log("Tpl.b 13 opções de modelo presentes", optionsCount === 13, `count=${optionsCount}`);

  const optgroupCount = await select.locator("optgroup").count();
  log("Tpl.c 5 optgroups (UTI/Clínica/Pediatria/UBS/UPA)", optgroupCount === 5, `count=${optgroupCount}`);

  // 3) Default carrega clinica-problemas (enfermaria_clinica)
  const defaultVal = await select.inputValue();
  log("Tpl.d Default 'clinica-problemas' para enfermaria_clinica", defaultVal === "clinica-problemas", `valor=${defaultVal}`);

  // 4) Trocar para UTI-sistemas
  await select.selectOption("uti-sistemas");
  await page.waitForTimeout(200);
  const newVal = await select.inputValue();
  log("Tpl.e Troca para 'uti-sistemas'", newVal === "uti-sistemas");

  // 5) Persistência: recarregar mantém o valor
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const reloadedVal = await page.locator('select[aria-label="Modelo de evolução"]').inputValue();
  log("Tpl.f Template persiste por paciente após reload", reloadedVal === "uti-sistemas", `valor=${reloadedVal}`);

  // 6) Toggle de "anotações brutas"
  const toggleBtn = page.locator("button:has-text('USAR ANOTAÇÕES BRUTAS')").or(page.locator("button:has-text('OCULTAR ANOTAÇÕES BRUTAS')"));
  await toggleBtn.waitFor({ timeout: 3000 });
  log("Tpl.g Toggle de anotações brutas renderiza", true);

  await toggleBtn.click();
  await page.waitForTimeout(200);
  const rawTextarea = page.locator('textarea[aria-label="Anotações brutas para reestruturação"]');
  log("Tpl.h Textarea de anotações abre", (await rawTextarea.count()) > 0);

  await rawTextarea.fill("PACIENTE EM VM, FIO2 30, PEEP 8, RASS -3, NORADRENALINA 0.1 MCG/KG/MIN, LACTATO 1.2");
  await page.waitForTimeout(200);

  // 7) Gerar evolução manda template_id, output_style e raw_notes
  await page.getByRole("button", { name: /GERAR EVOLU/i }).click();
  await page.waitForTimeout(1200);

  log("Tpl.i Payload tem template_id=uti-sistemas", lastGenBody?.template_id === "uti-sistemas", `id=${lastGenBody?.template_id}`);
  log("Tpl.j Payload tem output_style=sections", lastGenBody?.output_style === "sections", `style=${lastGenBody?.output_style}`);
  log("Tpl.k Payload tem raw_notes preenchido", typeof lastGenBody?.raw_notes === "string" && lastGenBody.raw_notes.includes("RASS -3"), `len=${lastGenBody?.raw_notes?.length}`);
  log("Tpl.l Payload tem template (prompt) começando com 'Você é'", String(lastGenBody?.template || "").includes("UTI"), `len=${lastGenBody?.template?.length}`);
} catch (e) {
  log("Tpl falha geral", false, e.message);
  console.log(e);
}

await browser.close();
const passed = results.filter(r => r.ok).length;
const failed = results.filter(r => !r.ok).length;
console.log(`\n${passed} passou(aram), ${failed} falhou(aram).`);
process.exit(failed === 0 ? 0 : 1);
