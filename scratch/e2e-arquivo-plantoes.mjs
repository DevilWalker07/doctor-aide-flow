import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:5173";
const SHIFT_ID = "shift_arquivo_001";

const SEED = {
  da_local_user_id: "00000000-0000-4000-8000-000000000a01",
  da_shift_id: SHIFT_ID,
  da_tipo_evolucao: "enfermaria_clinica",
  da_plantao_ativo: JSON.stringify({
    id: SHIFT_ID, data: "2026-05-16", data_formatada: "16/05/2026",
    setor: "ENFERMARIA", hospital: "Hospital Arquivo", tipo: "enfermaria_clinica",
    status: "active", criado_em: Date.now(),
  }),
  da_pacientes: JSON.stringify([
    { id: "p1", nome: "PACIENTE A", shift_id: SHIFT_ID, setor: "ENFERMARIA", leito: "01", idade: 60, sexo: "M", status: "internado" },
    { id: "p2", nome: "PACIENTE B", shift_id: SHIFT_ID, setor: "ENFERMARIA", leito: "02", idade: 70, sexo: "F", status: "internado" },
  ]),
  da_evolucoes: JSON.stringify([
    { id: "e1", patient_id: "p1", shift_id: SHIFT_ID, content: "EVO 1", created_at: "2026-05-16T08:00:00Z" },
  ]),
  da_prescricoes: JSON.stringify([]),
  da_encaminhamentos: JSON.stringify([]),
  da_passagens: JSON.stringify([]),
};

const results = [];
const log = (n, ok, d = "") => { results.push({ n, ok, d }); console.log(`${ok ? "✅" : "❌"} ${n}${d ? ` — ${d}` : ""}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.evaluate((seed) => { for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v); }, SEED);

try {
  // 1) Chamar archiveCurrentShift via API exposta no namespace storage
  const archived = await page.evaluate(async () => {
    const mod = await import("/src/lib/storage.ts");
    return mod.storage.archiveCurrentShift();
  });
  log("Arq.a archiveCurrentShift retorna snapshot", !!archived && archived.shift_id === "shift_arquivo_001");
  log("Arq.b Snapshot tem 2 pacientes", archived?.snapshot?.pacientes?.length === 2, `count=${archived?.snapshot?.pacientes?.length}`);
  log("Arq.c Snapshot tem 1 evolução", archived?.snapshot?.evolucoes?.length === 1);

  // 2) listArchivedShifts retorna o plantão
  const list = await page.evaluate(async () => {
    const mod = await import("/src/lib/storage.ts");
    return mod.storage.listArchivedShifts();
  });
  log("Arq.d listArchivedShifts retorna 1 plantão", list.length === 1);
  log("Arq.e Plantão arquivado tem campos corretos",
      list[0]?.setor === "ENFERMARIA" && list[0]?.hospital === "Hospital Arquivo");

  // 3) clearSession deve arquivar de novo e limpar
  await page.evaluate(async () => {
    const mod = await import("/src/lib/storage.ts");
    mod.storage.clearSession();
  });
  const afterClear = await page.evaluate(() => ({
    pacientes: localStorage.getItem("da_pacientes"),
    evolucoes: localStorage.getItem("da_evolucoes"),
    shiftId: localStorage.getItem("da_shift_id"),
    arquivo: JSON.parse(localStorage.getItem("da_arquivo_plantoes") || "[]"),
  }));
  log("Arq.f clearSession limpa da_pacientes", afterClear.pacientes === null);
  log("Arq.g clearSession limpa da_evolucoes", afterClear.evolucoes === null);
  log("Arq.h clearSession limpa da_shift_id", afterClear.shiftId === null);
  log("Arq.i Arquivo PERSISTE após clearSession", afterClear.arquivo.length === 1, `len=${afterClear.arquivo.length}`);

  // 4) reopenArchivedShift restaura o estado
  const reopened = await page.evaluate(async () => {
    const mod = await import("/src/lib/storage.ts");
    return mod.storage.reopenArchivedShift("shift_arquivo_001");
  });
  log("Arq.j reopenArchivedShift retorna true", reopened === true);

  const restored = await page.evaluate(() => ({
    pacientes: JSON.parse(localStorage.getItem("da_pacientes") || "[]"),
    evolucoes: JSON.parse(localStorage.getItem("da_evolucoes") || "[]"),
    shiftId: localStorage.getItem("da_shift_id"),
    plantao: JSON.parse(localStorage.getItem("da_plantao_ativo") || "null"),
    arquivo: JSON.parse(localStorage.getItem("da_arquivo_plantoes") || "[]"),
  }));
  log("Arq.k Reopen restaura 2 pacientes", restored.pacientes.length === 2);
  log("Arq.l Reopen restaura 1 evolução", restored.evolucoes.length === 1);
  log("Arq.m Reopen restaura shift_id", restored.shiftId === "shift_arquivo_001");
  log("Arq.n Reopen restaura plantao_ativo", restored.plantao?.setor === "ENFERMARIA");
  log("Arq.o Reopen remove do arquivo (agora ativo)", restored.arquivo.length === 0);
} catch (e) {
  log("Arq falha geral", false, e.message);
  console.log(e);
}

await browser.close();
const passed = results.filter(r => r.ok).length;
const failed = results.filter(r => !r.ok).length;
console.log(`\n${passed} passou(aram), ${failed} falhou(aram).`);
process.exit(failed === 0 ? 0 : 1);
