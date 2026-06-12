import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:5173";

const SEED_COM_ATIVO = {
  da_local_user_id: "00000000-0000-4000-8000-000000000d01",
  da_shift_id: "shift_ativo_d",
  da_tipo_evolucao: "uti",
  da_plantao_ativo: JSON.stringify({
    id: "shift_ativo_d", data: "2026-05-16", data_formatada: "16/05/2026",
    setor: "UTI", hospital: "Hospital D", tipo: "uti", status: "active", criado_em: Date.now(),
  }),
  da_pacientes: JSON.stringify([
    { id: "pa1", nome: "PAC ATIVO 1", shift_id: "shift_ativo_d", setor: "UTI", leito: "U1" },
  ]),
  da_arquivo_plantoes: JSON.stringify([
    {
      shift_id: "shift_arq_d_1", hospital: "Hospital D", setor: "ENFERMARIA",
      tipo: "enfermaria_clinica", data: "2026-05-10", data_formatada: "10/05/2026",
      encerrado_em: "2026-05-11T08:00:00Z",
      snapshot: { pacientes: [{ id: "px", nome: "ARQ A" }, { id: "py", nome: "ARQ B" }], evolucoes: [{}], prescricoes: [], encaminhamentos: [], passagens: [{ content: "Passagem teste arquivada" }] },
    },
    {
      shift_id: "shift_arq_d_2", hospital: "Hospital D", setor: "UPA",
      tipo: "upa", data: "2026-05-05", data_formatada: "05/05/2026",
      encerrado_em: "2026-05-06T08:00:00Z",
      snapshot: { pacientes: [{ id: "pz", nome: "ARQ C" }], evolucoes: [], prescricoes: [], encaminhamentos: [], passagens: [] },
    },
  ]),
};

const results = [];
const log = (n, ok, d = "") => { results.push({ n, ok, d }); console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
page.on("dialog", async (d) => { await d.accept(); });

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.evaluate((seed) => { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }, SEED_COM_ATIVO);

try {
  await page.goto(`${BASE}/plantoes`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  // 1) Tab Ativo é default
  log("Plt.a Tab ATIVO destacado", await page.locator('button[role="tab"][aria-selected="true"]').filter({ hasText: /ATIVO/i }).count() > 0);

  // 2) Card do plantão ativo aparece
  log("Plt.b Card 'PLANTÃO ATIVO' visível", await page.locator("text=PLANTÃO ATIVO").count() > 0);
  log("Plt.c Setor UTI exibido", await page.locator("h2:has-text('UTI')").count() > 0);
  log("Plt.d Hospital exibido", await page.locator("text=Hospital D").count() > 0);

  // 3) Contagem de pacientes
  log("Plt.e 1 paciente do plantão ativo", await page.locator("text=PACIENTES NESTE PLANTÃO").count() > 0);

  // 4) Botão CONTINUAR funciona
  await page.getByRole("button", { name: /CONTINUAR/i }).first().click();
  await page.waitForTimeout(800);
  log("Plt.f Click CONTINUAR vai pro dashboard", page.url().includes("/dashboard"));

  // 5) Voltar pra /plantoes e ir pra tab arquivados
  await page.goto(`${BASE}/plantoes?tab=arquivados`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  log("Plt.g Deep link ?tab=arquivados ativa tab", await page.locator('button[role="tab"][aria-selected="true"]').filter({ hasText: /ARQUIVADOS/i }).count() > 0);

  // 6) 2 arquivados visíveis
  log("Plt.h 'ENFERMARIA' arquivado visível", await page.locator("text=ENFERMARIA").count() > 0);
  log("Plt.i 'UPA' arquivado visível", await page.locator("text=/^UPA$/").count() > 0 || await page.locator("h3:has-text('UPA')").count() > 0);
  log("Plt.j 2 botões VER PASSAGEM", await page.locator("text=VER PASSAGEM").count() === 2);
  log("Plt.k 2 botões REABRIR", await page.locator("text=REABRIR").count() === 2);

  // 7) Click VER PASSAGEM abre modal
  await page.locator("text=VER PASSAGEM").first().click();
  await page.waitForTimeout(400);
  log("Plt.l Modal de passagem abre", await page.locator("text=PASSAGENS DO PLANTÃO").count() > 0);
  log("Plt.m Modal mostra conteúdo da passagem", await page.locator("text=Passagem teste arquivada").count() > 0);
  // fechar modal
  await page.locator('button[aria-label="Fechar"]').or(page.locator('button:has(svg)').filter({ hasNotText: /./ })).first().click().catch(() => {});
  await page.waitForTimeout(200);

  // 8) Click REABRIR com confirm (já automatizado o accept)
  await page.locator("text=REABRIR").first().click();
  await page.waitForTimeout(1200);
  log("Plt.n REABRIR navega para /dashboard", page.url().includes("/dashboard"));

  // 9) Confirma que pacientes do arquivo foram restaurados em da_pacientes
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem("da_pacientes") || "[]"));
  log("Plt.o Pacientes restaurados do arquivo", restored.length === 2 && restored.some((p) => p.nome === "ARQ A"));

  // 10) Tab novo plantão
  await page.goto(`${BASE}/plantoes?tab=novo`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  log("Plt.p Tab Novo mostra botão INICIAR", await page.locator("text=INICIAR NOVO PLANTÃO").count() > 0);
} catch (e) {
  log("Plt falha geral", false, e.message);
  console.log(e);
}

await browser.close();
const passed = results.filter(r => r.ok).length;
const failed = results.filter(r => !r.ok).length;
console.log(`\n${passed} passou(aram), ${failed} falhou(aram).`);
process.exit(failed === 0 ? 0 : 1);
