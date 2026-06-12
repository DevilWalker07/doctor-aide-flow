import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:5173";

// Cenário: médico tem 2 pacientes em plantão de pediatria e troca para plantão de UTI.
// Pacientes do plantão antigo NÃO devem aparecer no dashboard novo.

const SHIFT_PEDI_ID = "shift_pedi_001";
const SHIFT_UTI_ID = "shift_uti_002";

const SEED = {
  da_local_user_id: "00000000-0000-4000-8000-000000000222",
  da_shift_id: SHIFT_UTI_ID,
  da_tipo_evolucao: "uti",
  da_plantao_ativo: JSON.stringify({
    id: SHIFT_UTI_ID, data: "2026-05-16", data_formatada: "16/05/2026",
    setor: "UTI", hospital: "Hospital", tipo: "uti", status: "active", criado_em: Date.now(),
  }),
  da_pacientes: JSON.stringify([
    // Plantão antigo (pediatria)
    { id: "p_ped_1", nome: "CRIANCA UM",  shift_id: SHIFT_PEDI_ID, setor: "PEDIATRIA", leito: "P1", idade: 5, sexo: "F", motivo_admissao: "FEBRE", lista_de_problemas: [], antibioticos: [], laboratorios: [], pendencias: [], status: "internado" },
    { id: "p_ped_2", nome: "CRIANCA DOIS", shift_id: SHIFT_PEDI_ID, setor: "PEDIATRIA", leito: "P2", idade: 3, sexo: "M", motivo_admissao: "DESIDRATACAO", lista_de_problemas: [], antibioticos: [], laboratorios: [], pendencias: [], status: "internado" },
    // Plantão atual (UTI)
    { id: "p_uti_1", nome: "ADULTO UTI", shift_id: SHIFT_UTI_ID, setor: "UTI", leito: "U1", idade: 60, sexo: "M", motivo_admissao: "SEPSE", lista_de_problemas: [], antibioticos: [], laboratorios: [], pendencias: [], status: "internado" },
    // Legacy (sem shift_id) com setor UTI — deve aparecer
    { id: "p_legacy_uti", nome: "ADULTO LEGADO UTI", setor: "UTI", leito: "U2", idade: 70, sexo: "F", motivo_admissao: "AVC", lista_de_problemas: [], antibioticos: [], laboratorios: [], pendencias: [], status: "internado" },
    // Legacy (sem shift_id) com setor pediatria — NÃO deve aparecer no plantão UTI
    { id: "p_legacy_ped", nome: "CRIANCA LEGADA", setor: "PEDIATRIA", leito: "P3", idade: 4, sexo: "F", motivo_admissao: "CRISE", lista_de_problemas: [], antibioticos: [], laboratorios: [], pendencias: [], status: "internado" },
  ]),
};

const results = [];
const log = (n, ok, d = "") => { results.push({ n, ok, d }); console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.evaluate((seed) => { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }, SEED);

try {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  console.log("  DEBUG URL:", page.url());
  const bodySnippet = (await page.locator("body").innerText()).slice(0, 300).replace(/\n+/g, " | ");
  console.log("  DEBUG body:", bodySnippet);

  // Pacientes do plantão atual (UTI) DEVEM aparecer
  log("Iso.a 'ADULTO UTI' aparece no plantão UTI", await page.locator("text=ADULTO UTI").count() > 0);
  log("Iso.b 'ADULTO LEGADO UTI' (sem shift_id, mas setor=UTI) aparece", await page.locator("text=ADULTO LEGADO UTI").count() > 0);

  // Pacientes de plantão diferente NÃO devem aparecer
  log("Iso.c 'CRIANCA UM' (plantão pediátrico) NÃO aparece no plantão UTI", await page.locator("text=CRIANCA UM").count() === 0);
  log("Iso.d 'CRIANCA DOIS' (plantão pediátrico) NÃO aparece", await page.locator("text=CRIANCA DOIS").count() === 0);
  log("Iso.e 'CRIANCA LEGADA' (sem shift_id, setor pediatria) NÃO aparece no plantão UTI", await page.locator("text=CRIANCA LEGADA").count() === 0);

  // Total de cards de paciente: 2 (ADULTO UTI + ADULTO LEGADO UTI)
  const cards = await page.locator("h3.font-extrabold").count();
  log("Iso.f Dashboard mostra apenas 2 pacientes do plantão UTI", cards === 2, `cards=${cards}`);
} catch (e) {
  log("Iso falha geral", false, e.message);
}

await browser.close();
const passed = results.filter(r => r.ok).length;
const failed = results.filter(r => !r.ok).length;
console.log(`\n${passed} passou(aram), ${failed} falhou(aram).`);
process.exit(failed === 0 ? 0 : 1);
