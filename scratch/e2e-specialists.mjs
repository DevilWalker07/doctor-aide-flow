import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:5173";
const PATIENT_ID = "temp_p_spec";

const SEED = {
  da_local_user_id: "00000000-0000-4000-8000-000000000077",
  da_local_user_name: "Doutor Spec",
  da_shift_id: "temp_shift_spec",
  da_tipo_evolucao: "enfermaria_clinica",
  da_plantao_ativo: JSON.stringify({
    id: "temp_shift_spec", data: "2026-05-16", data_formatada: "16/05/2026",
    setor: "ENFERMARIA", hospital: "Hospital", status: "active", criado_em: Date.now(),
  }),
  da_pacientes: JSON.stringify([
    {
      id: PATIENT_ID,
      nome: "PACIENTE SPECIALIST TESTE",
      leito: "L11", idade: 65, sexo: "M",
      setor: "ENFERMARIA",
      data_admissao: "2026-05-12",
      motivo_admissao: "PNEUMONIA COMUNITARIA",
      lista_de_problemas: [{ id: "x", text: "Pneumonia" }],
      antibioticos: [{ id: "a", nome: "CEFTRIAXONA", dose: "1g", via: "IV", frequencia: "12/12h", dataInicio: "2026-05-12" }],
      laboratorios: [{ id: "l", data: "2026-05-15", valor: "HB 11 | LEUCO 14500 | PCR 120" }],
      pendencias: [{ id: "p", text: "Aguarda cultura" }],
      status: "internado",
    },
  ]),
};

let lastConsultBody = null;
const MOCK_CONSULT = {
  specialist: "Dr. Victor",
  specialist_id: "victor",
  generated_at: new Date().toISOString(),
  sections: [
    { title: "AVALIACAO DIAGNOSTICA", content: "Diagnóstico de PAC compatível.", alert: false },
    { title: "ANTIBIOTICOTERAPIA", content: "Ceftriaxona D4. Considerar desescalonamento se cultura negativa.", alert: true },
  ],
  suggestions: [
    { id: "s1", text: "Solicitar hemocultura antes de trocar ATB", priority: "alta" },
    { id: "s2", text: "Adicionar azitromicina 500mg VO 1x/dia", priority: "media" },
    { id: "s3", text: "Avaliar O2 se SpO2 < 92%", priority: "baixa" },
  ],
  references: ["Harrison's 21a", "Diretriz AMB 2024"],
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

await page.route("**/api/specialists/consult", async (route) => {
  lastConsultBody = JSON.parse(route.request().postData() || "{}");
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_CONSULT) });
});

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.evaluate((seed) => {
  for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
}, SEED);

try {
  // F-A: na pagina do paciente, card aparece
  await page.goto(`${BASE}/paciente/${PATIENT_ID}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  log("Spec.a Card do especialista renderiza", await page.locator("text=SEGUNDA OPINIÃO IA").count() > 0);

  const drVictor = page.locator("text=Dr. Victor").first();
  log("Spec.b Nome Dr. Victor visivel (clinica medica = victor)", await drVictor.count() > 0);

  // Clicar Solicitar Parecer
  const solicitarBtn = page.getByRole("button", { name: /Solicitar Parecer/i });
  await solicitarBtn.click();
  await page.waitForTimeout(1200);

  // Drawer abre
  const drawer = page.locator('[role="dialog"][aria-label*="Parecer"]');
  log("Spec.c Drawer abre", await drawer.count() > 0);

  // Payload enviado tem clinical_context com dados do paciente
  log("Spec.d Payload tem specialist_id=victor", lastConsultBody?.specialist_id === "victor");
  log("Spec.e Payload tem clinical_context com CEFTRIAXONA",
      String(lastConsultBody?.clinical_context || "").includes("CEFTRIAXONA"));
  log("Spec.f Payload tem labs do paciente",
      String(lastConsultBody?.clinical_context || "").includes("HB 11"));
  log("Spec.g Payload tem motivo admissao",
      String(lastConsultBody?.clinical_context || "").toUpperCase().includes("PNEUMONIA"));

  // Seções aparecem
  log("Spec.h Secao AVALIACAO DIAGNOSTICA visivel", await page.locator("text=/AVALIACAO DIAGNOSTICA|AVALIAÇÃO DIAGNOSTICA/i").count() > 0);
  log("Spec.i Secao ANTIBIOTICOTERAPIA visivel com alerta", await page.locator("text=ANTIBIOTICOTERAPIA").count() > 0);

  // Sugestões com checkboxes
  const checkboxes = page.locator('input[type="checkbox"]');
  const cbCount = await checkboxes.count();
  log("Spec.j 3 sugestoes com checkbox", cbCount >= 3, `count=${cbCount}`);

  // Referências
  log("Spec.k Referencias listadas", await page.locator("text=Harrison's 21a").count() > 0);

  // Marcar 2 sugestões e aceitar
  await checkboxes.nth(0).check();
  await checkboxes.nth(1).check();
  await page.waitForTimeout(200);

  const acceptBtn = page.getByRole("button", { name: /Aceitar selecionadas/i });
  await acceptBtn.click();
  await page.waitForTimeout(600);

  // Verifica que as sugestões viraram pendências no paciente local
  const pendencias = await page.evaluate((id) => {
    const arr = JSON.parse(localStorage.getItem("da_pacientes") || "[]");
    const p = arr.find(x => x.id === id);
    return p?.pendencias || p?.pending_issues || [];
  }, PATIENT_ID);
  log("Spec.l Sugestoes aceitas viram pendencias",
      pendencias.length >= 3, `count=${pendencias.length}`);

  // Drawer fecha
  log("Spec.m Drawer fecha apos aceitar", (await drawer.count()) === 0);

  // Recarrega: badge "PARECER DISPONÍVEL" aparece (saveConsultForPatient gravou)
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  log("Spec.n Badge 'PARECER DISPONÍVEL' aparece apos consulta", await page.locator("text=PARECER DISPONÍVEL").count() > 0);

  // F-B: tela de evolucao tambem tem botao do especialista
  await page.goto(`${BASE}/evolucao/${PATIENT_ID}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  // Botao inline aparece (variant=inline = "Parecer do(a) Dr. Victor")
  const inlineBtn = page.getByRole("button", { name: /Parecer do\(a\) Dr\. Victor/i });
  log("Spec.o Botao inline no header da evolucao", await inlineBtn.count() > 0);
} catch (e) {
  log("Spec falha geral", false, e.message);
  console.log(e);
}

await browser.close();
const passed = results.filter(r => r.ok).length;
const failed = results.filter(r => !r.ok).length;
console.log(`\n${passed} passou(aram), ${failed} falhou(aram).`);
process.exit(failed === 0 ? 0 : 1);
