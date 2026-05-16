import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:5173";

const localStorageSeed = {
  da_local_user_id: "00000000-0000-4000-8000-000000000001",
  da_local_user_name: "Doutor Teste",
  da_nome_medico: "Dr. Teste",
  da_crm: "CRM-SP 12345",
  da_hospital_padrao: "Hospital E2E",
  da_shift_id: "temp_shift_e2e",
  da_tipo_evolucao: "enfermaria_clinica",
  da_plantao_ativo: JSON.stringify({
    id: "temp_shift_e2e",
    data: "2026-05-16",
    data_formatada: "16/05/2026",
    setor: "ENFERMARIA",
    hospital: "Hospital E2E",
    tipo: "enfermaria_clinica",
    status: "active",
    criado_em: Date.now(),
  }),
  da_pacientes: JSON.stringify([
    {
      id: "temp_p_critico",
      nome: "PACIENTE CRITICO",
      leito: "L01",
      idade: "72",
      sexo: "M",
      motivo_admissao: "SEPSE GRAVE EM CHOQUE",
      lista_de_problemas: [{ id: "x1", text: "Sepse" }],
      antibioticos: [{ id: "a1", nome: "MEROPENEM", dose: "1g", via: "IV", frequencia: "8/8h", dataInicio: "2026-05-12" }],
      medicacoes: [],
      laboratorios: [],
      pendencias: [{ id: "p1", text: "AGUARDA CULTURA" }],
      status: "internado",
    },
    {
      id: "temp_p_leve",
      nome: "PACIENTE LEVE",
      leito: "L05",
      idade: "45",
      sexo: "F",
      motivo_admissao: "OBSERVACAO ESTAVEL",
      lista_de_problemas: [],
      antibioticos: [],
      medicacoes: [],
      laboratorios: [],
      pendencias: [],
      status: "alta_provavel",
    },
    {
      id: "temp_p_grave",
      nome: "PACIENTE GRAVE",
      leito: "L03",
      idade: "60",
      sexo: "F",
      motivo_admissao: "PNEUMONIA",
      lista_de_problemas: [{ id: "x2", text: "Pneumonia" }],
      antibioticos: [{ id: "a2", nome: "CEFTRIAXONA", dose: "1g", via: "IV", frequencia: "12/12h", dataInicio: "2026-05-13" }],
      medicacoes: [],
      laboratorios: [],
      pendencias: [{ id: "p2", text: "RAIO X CONTROLE" }],
      status: "internado",
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

// Mock dos endpoints de IA (geração e refinar) e export
let lastExportBody = null;
await page.route("**/api/ai/gerar-evolucao", (route) =>
  route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ evolution_text: "TEXTO DA EVOLUÇÃO GERADA" }),
  })
);
await page.route("**/api/export/evolucao", async (route) => {
  const req = route.request();
  lastExportBody = JSON.parse(req.postData() || "{}");
  // Devolve um arquivo binário pequeno como mock
  const body = "MOCK_FILE_CONTENT_" + lastExportBody.format;
  route.fulfill({
    status: 200,
    headers: { "Content-Disposition": `attachment; filename="mock.${lastExportBody.format}"` },
    contentType: "application/octet-stream",
    body,
  });
});

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.evaluate((seed) => {
  for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
}, localStorageSeed);

// ========== F6: Dashboard triagem visual ==========
try {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const criticosCard = page.locator("text=CRÍTICOS").first();
  await criticosCard.waitFor({ timeout: 5000 });
  log("F6.a Card de gravidade 'CRÍTICOS' renderiza", true);

  const gravesCard = page.locator("text=GRAVES").first();
  log("F6.b Card de gravidade 'GRAVES' renderiza", (await gravesCard.count()) > 0);

  const altaCard = page.locator("text=ALTA POSSÍVEL").first();
  log("F6.c Card de gravidade 'ALTA POSSÍVEL' renderiza", (await altaCard.count()) > 0);

  const searchBox = page.getByPlaceholder(/Buscar por nome/i);
  await searchBox.waitFor({ timeout: 3000 });
  log("F6.d Barra de busca renderiza", true);

  // Conteúdo geral mostra os 3 pacientes
  const totalBefore = await page.locator("text=/PACIENTE (CRITICO|GRAVE|LEVE)/i").count();
  log("F6.e 3 pacientes visíveis no dashboard", totalBefore === 3, `count=${totalBefore}`);

  // Ordem por gravidade: o primeiro card de paciente deve ser o crítico
  const firstCardName = await page.locator("h3.font-extrabold").first().textContent();
  log("F6.f Primeiro card é o CRÍTICO", (firstCardName || "").includes("CRITICO"), `primeiro="${firstCardName}"`);

  // Badge de gravidade aparece no card crítico
  const criticoBadge = await page.locator("text=/CRÍTICO/i").count();
  log("F6.g Badge 'CRÍTICO' aparece", criticoBadge > 0);

  // Busca filtra por nome
  await searchBox.fill("leve");
  await page.waitForTimeout(300);
  const filteredCount = await page.locator("text=/PACIENTE (CRITICO|GRAVE|LEVE)/i").count();
  log("F6.h Busca filtra por nome", filteredCount === 1, `count=${filteredCount}`);

  // Limpa busca, filtra por críticos
  await searchBox.fill("");
  await page.waitForTimeout(200);
  await page.locator("text=CRÍTICOS").first().click();
  await page.waitForTimeout(300);
  const onlyCritico = await page.locator("text=/PACIENTE (CRITICO|GRAVE|LEVE)/i").count();
  log("F6.i Filtro 'CRÍTICOS' mostra só 1", onlyCritico === 1, `count=${onlyCritico}`);

  // Indicador ATB D{N} no card grave
  const atbDay = await page.locator("text=/ATB D\\d+/").count();
  log("F6.j Badge ATB D{N} aparece em pacientes com ATB", atbDay >= 1, `count=${atbDay}`);
} catch (e) {
  log("F6 Dashboard triagem visual", false, e.message);
}

// ========== F3: Export DOCX/PDF/TXT da evolução ==========
try {
  // Navegar pra evolução do paciente leve e gerar texto
  await page.goto(`${BASE}/evolucao/temp_p_leve`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  // Verifica que os 3 botões estão renderizados
  const docxBtn = page.getByRole("button", { name: /^DOCX$/i });
  const pdfBtn = page.getByRole("button", { name: /^PDF$/i });
  const txtBtn = page.getByRole("button", { name: /^TXT$/i });
  log("F3.a Botão DOCX renderiza", (await docxBtn.count()) > 0);
  log("F3.b Botão PDF renderiza", (await pdfBtn.count()) > 0);
  log("F3.c Botão TXT renderiza", (await txtBtn.count()) > 0);

  // Sem texto: botões disabled
  const disabledNoText = await docxBtn.isDisabled();
  log("F3.d Botão DOCX desabilitado sem texto", disabledNoText);

  // Gerar evolução pra ter texto
  await page.getByRole("button", { name: /GERAR EVOLU/i }).click();
  await page.waitForTimeout(1000);

  // Botão fica habilitado
  const enabledAfter = !(await docxBtn.isDisabled());
  log("F3.e Botão DOCX habilita após gerar texto", enabledAfter);

  // Clicar DOCX e verificar payload enviado
  const downloadPromise = page.waitForEvent("download", { timeout: 5000 }).catch(() => null);
  await docxBtn.click();
  await page.waitForTimeout(800);

  log("F3.f Payload enviado tem format=docx", lastExportBody?.format === "docx", `format=${lastExportBody?.format}`);
  log("F3.g Payload tem header.medico", !!lastExportBody?.header?.medico, `medico=${lastExportBody?.header?.medico}`);
  log("F3.h Payload tem header.paciente", !!lastExportBody?.header?.paciente, `paciente=${lastExportBody?.header?.paciente}`);
  log("F3.i Payload tem text", typeof lastExportBody?.text === "string" && lastExportBody.text.length > 0);

  const download = await downloadPromise;
  log("F3.j Download disparado", !!download, download ? `name=${download.suggestedFilename()}` : "sem download");

  // TXT é client-side — verifica que dispara download sem chamar a rota
  lastExportBody = null;
  const txtDownload = page.waitForEvent("download", { timeout: 5000 }).catch(() => null);
  await txtBtn.click();
  await page.waitForTimeout(500);
  const txt = await txtDownload;
  log("F3.k TXT gera download client-side", !!txt && lastExportBody === null, txt ? `name=${txt.suggestedFilename()}` : "sem download");
} catch (e) {
  log("F3 Export evolução", false, e.message);
}

await browser.close();

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${passed} passou(aram), ${failed} falhou(aram).`);
process.exit(failed === 0 ? 0 : 1);
