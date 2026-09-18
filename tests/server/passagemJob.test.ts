import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { makeApp, waitFor } from "./helpers/app.js";
import { aiMock, resetAiMock, storageMock } from "./helpers/mocks.js";

const { app, jobStore } = makeApp();
const auth = { Authorization: "Bearer valid-token" };
const USER = "user-1";

/** Uma evolução fictícia por leito, com dado suficiente para o extrator. */
function evolucao(n: number): Buffer {
  return Buffer.from(
    `EVOLUÇÃO 18/09/2026 — LEITO CMF ${String(n).padStart(2, "0")} — PACIENTE TESTE ${n}, 70a — DIH 10/09/2026\n` +
      `Pneumonia. Ceftriaxona 1g EV 12/12h desde 12/09. Lab: Hb 10,4 Leuco 11.200 Cr 1,1 PCR 62.\n` +
      `Conduta: manter ATB.`,
    "utf-8",
  );
}

function subir(quantos: number): string[] {
  return Array.from({ length: quantos }, (_, i) => {
    const caminho = `${USER}/L${String(i + 1).padStart(2, "0")}.txt`;
    storageMock.put(caminho, evolucao(i + 1));
    return caminho;
  });
}

async function esperarFim(jobId: string) {
  return waitFor(
    async () =>
      (await request(app).get(`/api/passagem-plantao/job/${jobId}`).set(auth)).body as {
        status: string;
        docx: { nome: string; url: string } | null;
        warnings: string[];
        contagem: { pacientes: number } | null;
      },
    (j) => j.status === "done" || j.status === "error",
    30_000,
  );
}

describe("passagem de plantão como job, um lote por invocação", () => {
  beforeEach(() => {
    resetAiMock();
    storageMock.reset();
  });

  it("15 arquivos → 3 lotes encadeados → DOCX pronto", async () => {
    // É o volume do plantão real. Na Vercel do plano hobby cada invocação tem
    // 60 s; três chamadas de IA numa requisição só encostariam nesse teto.
    const caminhos = subir(15);

    const inicio = await request(app)
      .post("/api/passagem-plantao/gerar")
      .set(auth)
      .send({ storage_paths: caminhos, setor: "CMF", data: "18/09/2026" });

    expect(inicio.status).toBe(202);
    expect(inicio.body.arquivos).toBe(15);
    expect(inicio.body.lotes).toBe(3);

    const fim = await esperarFim(inicio.body.job_id);
    expect(fim.status).toBe("done");
    expect(fim.docx?.nome).toMatch(/MAPA_PASSAGEM_CMF_18-09-2026\.docx/);
    expect(fim.docx?.url).toBeTruthy();
  });

  it("um lote falhando não derruba os outros: o DOCX sai assim mesmo", async () => {
    // 12 dos 15 leitos lidos vale muito mais que nenhum, no meio do plantão.
    const caminhos = subir(15);
    let chamada = 0;
    const original = aiMock.json.getMockImplementation()!;
    aiMock.json.mockImplementation(async (s, p, schema, opts) => {
      chamada += 1;
      if (chamada === 2) return { ok: false, error: "lote 2 quebrou de propósito" };
      return original(s, p, schema, opts);
    });

    const inicio = await request(app)
      .post("/api/passagem-plantao/gerar")
      .set(auth)
      .send({ storage_paths: caminhos, setor: "CMF", data: "18/09/2026" });
    expect(inicio.status).toBe(202);

    const fim = await esperarFim(inicio.body.job_id);
    expect(fim.status).toBe("done");
    expect(fim.docx).toBeTruthy();
    expect(fim.warnings.some((w) => /Lote 2 falhou/.test(w))).toBe(true);
  });

  it("todos os lotes falhando vira erro legível, não DOCX vazio", async () => {
    const caminhos = subir(8);
    aiMock.json.mockImplementation(async () => ({ ok: false, error: "IA fora" }));

    const inicio = await request(app)
      .post("/api/passagem-plantao/gerar")
      .set(auth)
      .send({ storage_paths: caminhos, setor: "CMF", data: "18/09/2026" });

    const fim = await esperarFim(inicio.body.job_id);
    expect(fim.status).toBe("error");
    expect(fim.docx).toBeNull();
  });

  it("422 quando nenhum arquivo tem texto aproveitável", async () => {
    storageMock.put(`${USER}/vazio.txt`, Buffer.from("   ", "utf-8"));
    const res = await request(app)
      .post("/api/passagem-plantao/gerar")
      .set(auth)
      .send({ storage_paths: [`${USER}/vazio.txt`], setor: "CMF", data: "18/09/2026" });
    expect(res.status).toBe(422);
  });

  it("recusa caminho na pasta de outro médico", async () => {
    storageMock.put("user-2/L01.txt", evolucao(1));
    const res = await request(app)
      .post("/api/passagem-plantao/gerar")
      .set(auth)
      .send({ storage_paths: ["user-2/L01.txt"], setor: "CMF", data: "18/09/2026" });
    expect(res.status).toBe(403);
  });

  it("o job de outro médico não é consultável", async () => {
    const inicio = await request(app)
      .post("/api/passagem-plantao/gerar")
      .set(auth)
      .send({ storage_paths: subir(2), setor: "CMF", data: "18/09/2026" });
    await esperarFim(inicio.body.job_id);

    const outro = await request(app)
      .get(`/api/passagem-plantao/job/${inicio.body.job_id}`)
      .set("Authorization", "Bearer other-token");
    expect(outro.status).toBe(404);
    const guardado = await jobStore.get(inicio.body.job_id);
    expect(guardado?.user_id).toBe(USER);
  });
});
