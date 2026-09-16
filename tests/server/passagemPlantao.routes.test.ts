import path from "node:path";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { makeApp } from "./helpers/app.js";
import { aiMock, resetAiMock } from "./helpers/mocks.js";

const { app } = makeApp();
const auth = { Authorization: "Bearer valid-token" };
const fixtures = path.resolve(__dirname, "../fixtures");
const txt = path.join(fixtures, "evolucao.txt");

function gerar(files: Array<string | [Buffer, string]>, fields: Record<string, string> = {}) {
  let req = request(app).post("/api/passagem-plantao/gerar").set(auth);
  for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
  for (const f of files)
    req = typeof f === "string" ? req.attach("files", f) : req.attach("files", f[0], f[1]);
  return req;
}

describe("/api/passagem-plantao/gerar", () => {
  beforeEach(resetAiMock);

  it("2 arquivos → DOCX válido com headers de contagem", async () => {
    const res = await gerar([txt, path.join(fixtures, "test.docx")], {
      setor: "CMF",
      data: "15/09/2026",
    })
      .buffer()
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on("data", (c) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("wordprocessingml");
    expect(res.headers["content-disposition"]).toContain("MAPA_PASSAGEM_CMF_15-09-2026.docx");
    expect(res.headers["x-pacientes-count"]).toBe("2");
    expect(Number(res.headers["x-alertas-count"])).toBeGreaterThanOrEqual(1);
    expect(res.headers["x-batches-failed"]).toBe("0");
    const buf = res.body as Buffer;
    expect(buf.subarray(0, 4).toString("latin1")).toBe("PK");
    expect(aiMock.json).toHaveBeenCalledTimes(1);
  });

  it("8 arquivos → 2 lotes (6 + 2) processados e mesclados por leito", async () => {
    const files = Array.from(
      { length: 8 },
      (_, i) => [Buffer.from(`LEITO L${i + 1}\nEVOLUCAO ${i}`), `ev${i}.txt`] as [Buffer, string],
    );
    const res = await gerar(files, { data: "15/09/2026" });
    expect(res.status).toBe(200);
    expect(aiMock.json).toHaveBeenCalledTimes(2);
    expect(res.headers["x-pacientes-count"]).toBe("2");
  });

  it("lote parcialmente falho → 200 com X-Batches-Failed e warnings", async () => {
    let call = 0;
    aiMock.json.mockImplementation(async (_s, _p, schema) => {
      call++;
      if (call === 1)
        return { ok: false, error: "Resposta da IA truncada (limite de tokens).", raw: "{" };
      const { aiFixtures } = await import("../../server/mocks/aiFixtures.js");
      return { ok: true, data: schema.parse(aiFixtures.passagemBatch) };
    });
    const files = Array.from(
      { length: 8 },
      (_, i) => [Buffer.from(`LEITO L${i + 1}`), `ev${i}.txt`] as [Buffer, string],
    );
    const res = await gerar(files, { data: "15/09/2026" });
    expect(res.status).toBe(200);
    expect(res.headers["x-batches-failed"]).toBe("1");
    expect(decodeURIComponent(res.headers["x-file-warnings"])).toContain("Lote 1 falhou");
  });

  it("todos os lotes falham → 502", async () => {
    aiMock.json.mockResolvedValue({
      ok: false,
      error: "A IA não retornou JSON válido.",
      raw: "xx",
    });
    const res = await gerar([txt], { data: "15/09/2026" });
    expect(res.status).toBe(502);
    expect(res.body.error).toBe("ai_invalid_response");
  });

  it("guardrail de lab insere alerta !! URGENTE a partir do K 5,7", async () => {
    const res = await gerar([txt], { data: "15/09/2026" });
    expect(Number(res.headers["x-alertas-count"])).toBe(2);
  });

  it("400 para data fora do formato DD/MM/AAAA", async () => {
    const res = await gerar([txt], { data: "2026-09-15" });
    expect(res.status).toBe(400);
    expect(res.body.issues[0].path).toBe("data");
  });

  it("400 para setor com caracteres inválidos", async () => {
    const res = await gerar([txt], { setor: '../x"\r\n', data: "15/09/2026" });
    expect(res.status).toBe(400);
  });

  it("415 para .doc legado", async () => {
    const res = await gerar([[Buffer.from("x"), "antigo.doc"]], { data: "15/09/2026" });
    expect(res.status).toBe(415);
  });

  it("422 quando nenhum arquivo tem texto", async () => {
    const res = await gerar([[Buffer.from("   \n  "), "vazio.txt"]], { data: "15/09/2026" });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe("no_text");
  });

  it("400 sem arquivos", async () => {
    const res = await request(app)
      .post("/api/passagem-plantao/gerar")
      .set(auth)
      .field("data", "15/09/2026");
    expect(res.status).toBe(400);
  });
});
