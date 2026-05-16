import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:5173";

const SEED = {
  da_local_user_id: "00000000-0000-4000-8000-000000000099",
  da_local_user_name: "Doutor Teste",
  da_shift_id: "temp_shift_fluxo",
  da_tipo_evolucao: "enfermaria_clinica",
  da_plantao_ativo: JSON.stringify({
    id: "temp_shift_fluxo", data: "2026-05-16", data_formatada: "16/05/2026",
    setor: "ENFERMARIA", hospital: "Hospital E2E", status: "active",
    criado_em: Date.now(),
  }),
  da_extracao_resultado: JSON.stringify({
    fileName: "documento.pdf",
    engine: "openai-text",
    markdown: "",
    extracted: {
      nome: "PACIENTE FLUXO TESTE",
      idade: 70,
      sexo: "F",
      leito: "L99",
      setor: "ENFERMARIA",
      data_admissao: "2026-05-12",
      motivo_admissao: "PNEUMONIA COMUNITÁRIA",
      hda: "Tosse e febre há 5 dias",
      lista_de_problemas: ["Pneumonia"],
      antibioticos: [
        { nome: "CEFTRIAXONA", dose: "1g", via: "IV", frequencia: "12/12h", data_inicio: "2026-05-12" },
      ],
      medicacoes: ["Losartana 50mg VO 1x/dia"],
      laboratorios: [{ data: "2026-05-15", texto_compacto: "HB 11 | LEUCO 14500 | PCR 120 | CR 1.1" }],
      exame_fisico_detalhado: { geral: "REG", acv: "RCR 2T", ar: "MV+ COM CREPTOS BASE D" },
      condutas: [],
      pendencias: ["Aguarda culturas"],
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

let lastGenerationBody = null;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

// Mock backend de geração — capturamos o que foi enviado
await page.route("**/api/ai/gerar-evolucao", async (route) => {
  lastGenerationBody = JSON.parse(route.request().postData() || "{}");
  route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ evolution_text: "TEXTO GERADO COM DADOS DO PACIENTE" }),
  });
});

// Seed localStorage + sessionStorage
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.evaluate((seed) => {
  for (const [k, v] of Object.entries(seed)) {
    localStorage.setItem(k, v);
    sessionStorage.setItem(k, v);
  }
}, SEED);

try {
  // 1) Vai pra /revisar-extracao e salva sem mudar nada
  await page.goto(`${BASE}/revisar-extracao`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const saveBtn = page.getByRole("button", { name: /SALVAR/i });
  await saveBtn.waitFor({ timeout: 5000 });
  log("Fluxo.a Botão SALVAR renderiza em revisar-extracao", true);

  await saveBtn.click();
  // Espera navegar pra /paciente/$id
  await page.waitForURL(/\/paciente\/[^/]+$/, { timeout: 8000 });
  const pacienteUrl = page.url();
  const patientId = pacienteUrl.split("/paciente/")[1];
  log("Fluxo.b Redirecionado para /paciente/$id após salvar", !!patientId, `id=${patientId}`);

  // 2) Confirma que o paciente foi gravado no localStorage
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("da_pacientes") || "[]"));
  log("Fluxo.c Paciente gravado em da_pacientes", saved.length > 0, `count=${saved.length}`);

  // 3) Vai pra evolucao do paciente
  await page.goto(`${BASE}/evolucao/${patientId}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // 4) Verifica que dados do paciente aparecem no painel lateral
  const labsVisible = await page.locator("text=/HB 11.*LEUCO 14500/i").count();
  log("Fluxo.d Labs do paciente aparecem no painel lateral", labsVisible > 0, `count=${labsVisible}`);

  const atbVisible = await page.locator("text=CEFTRIAXONA").count();
  log("Fluxo.e Antibiótico aparece no painel lateral", atbVisible > 0, `count=${atbVisible}`);

  const pendVisible = await page.locator("text=/AGUARDA CULTURAS|Aguarda culturas/i").count();
  log("Fluxo.f Pendência aparece no painel lateral", pendVisible > 0, `count=${pendVisible}`);

  // 5) Clica GERAR EVOLUÇÃO e captura o payload enviado pro backend
  await page.getByRole("button", { name: /GERAR EVOLU/i }).click();
  await page.waitForTimeout(1500);

  // Confirma que o payload contém os dados do paciente
  const patient = lastGenerationBody?.patient;
  log("Fluxo.g Payload enviado tem objeto patient", !!patient);
  log("Fluxo.h Payload tem antibióticos (não vazio)",
      Array.isArray(patient?.data?.abx) && patient.data.abx.length > 0,
      `abx_count=${patient?.data?.abx?.length}`);
  log("Fluxo.i Payload tem lab.formatted (não null)",
      !!patient?.data?.lab?.formatted,
      `lab=${patient?.data?.lab?.formatted?.slice(0, 30)}`);
  log("Fluxo.j Payload tem pendingIssues (não vazio)",
      Array.isArray(patient?.pendingIssues) && patient.pendingIssues.length > 0,
      `pend_count=${patient?.pendingIssues?.length}`);
  log("Fluxo.k Payload tem motivo_admissao",
      !!patient?.motivo_admissao,
      `motivo=${patient?.motivo_admissao}`);
  log("Fluxo.l Payload tem antecedentes/medicacoes_uso_continuo",
      Array.isArray(patient?.medicacoes_uso_continuo),
      `meds_count=${patient?.medicacoes_uso_continuo?.length}`);
} catch (e) {
  log("Fluxo falha geral", false, e.message);
  console.log(e);
}

await browser.close();
const passed = results.filter(r => r.ok).length;
const failed = results.filter(r => !r.ok).length;
console.log(`\n${passed} passou(aram), ${failed} falhou(aram).`);
process.exit(failed === 0 ? 0 : 1);
