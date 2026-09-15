import path from "node:path";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { makeApp, waitFor } from "./helpers/app.js";
import { resetAiMock } from "./helpers/mocks.js";

const { app, jobStore } = makeApp();
const auth = { Authorization: "Bearer valid-token" };
const fixtures = path.resolve(__dirname, "../fixtures");

async function createJob(file: string | Buffer, name?: string, headers: Record<string, string> = auth) {
  const req = request(app).post("/api/extract/extract-async").set(headers);
  const res = typeof file === "string" ? await req.attach("file", file) : await req.attach("file", file, name ?? "arquivo.bin");
  return res;
}

describe("/api/extract/*", () => {
  beforeEach(resetAiMock);

  it("txt → 202 → job done com resultado normalizado e sem defaults inventados", async () => {
    const res = await createJob(path.join(fixtures, "evolucao.txt"));
    expect(res.status).toBe(202);
    expect(res.body.job_id).toMatch(/^[0-9a-f-]{36}$/);

    const job = await waitFor(
      async () => (await request(app).get(`/api/extract/job/${res.body.job_id}`).set(auth)).body,
      (j) => j.status === "done" || j.status === "error",
    );
    expect(job.status).toBe("done");
    expect(job.result.nome).toBe("PACIENTE TESTE E2E");
    expect(job.result.engine).toBe("openai-direct");
    expect(job.result.suggested_patient.name).toBe("PACIENTE TESTE E2E");
    expect(job.result.uncertain_fields).toEqual([]);
  });

  it("txt UTF-16 com BOM é aceito e decodificado", async () => {
    const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("PACIENTE UTF16\nLEITO L01", "utf16le")]);
    const res = await createJob(utf16, "windows.txt");
    expect(res.status).toBe(202);
    const job = await waitFor(async () => (await request(app).get(`/api/extract/job/${res.body.job_id}`).set(auth)).body, (j) => j.status !== "queued" && j.status !== "processing");
    expect(job.status).toBe("done");
    expect(job.result.markdown).toContain("PACIENTE UTF16");
  });

  it("docx e pdf com texto são processados", async () => {
    for (const [file, engine] of [
      ["test.docx", "openai-direct"],
      ["test.pdf", "openai-direct-pdf"],
    ] as const) {
      const res = await createJob(path.join(fixtures, file));
      expect(res.status).toBe(202);
      const job = await waitFor(async () => (await request(app).get(`/api/extract/job/${res.body.job_id}`).set(auth)).body, (j) => j.status === "done" || j.status === "error");
      expect(job.status, file).toBe("done");
      expect(job.result.engine).toBe(engine);
    }
  });

  it("sexo nulo na extração vira '' no suggested_patient (nunca 'F' por padrão)", async () => {
    const { aiMock } = await import("./helpers/mocks.js");
    aiMock.json.mockImplementationOnce(async (_s, _p, schema) => ({ ok: true, data: schema.parse({ nome: null, sexo: null, idade: null }) }));
    const res = await createJob(path.join(fixtures, "evolucao.txt"));
    const job = await waitFor(async () => (await request(app).get(`/api/extract/job/${res.body.job_id}`).set(auth)).body, (j) => j.status === "done");
    expect(job.result.suggested_patient.sex).toBe("");
    expect(job.result.suggested_patient.name).toBe("");
    expect(job.result.suggested_patient.age).toBeNull();
    expect(job.result.uncertain_fields).toContain("nome");
  });

  it("415 quando o conteúdo não bate com a extensão (magic bytes)", async () => {
    const res = await createJob(Buffer.from("MZ\x90\x00binario"), "foto.jpg");
    expect(res.status).toBe(415);
    expect(res.body.error).toBe("unsupported_format");
  });

  it("415 para extensão fora da allowlist", async () => {
    const res = await createJob(Buffer.from("texto"), "virus.exe");
    expect(res.status).toBe(415);
  });

  it("413 acima de 20 MB", async () => {
    const res = await createJob(Buffer.alloc(21 * 1024 * 1024, 0x41), "grande.txt");
    expect(res.status).toBe(413);
    expect(res.body.error).toBe("upload_error");
  });

  it("400 sem arquivo", async () => {
    const res = await request(app).post("/api/extract/extract-async").set(auth).field("x", "y");
    expect(res.status).toBe(400);
  });

  it("job de outro usuário retorna 404", async () => {
    const res = await createJob(path.join(fixtures, "evolucao.txt"));
    const other = await request(app).get(`/api/extract/job/${res.body.job_id}`).set("Authorization", "Bearer other-token");
    expect(other.status).toBe(404);
    const stored = await jobStore.get(res.body.job_id);
    expect(stored?.user_id).toBe("user-1");
  });

  it("400 para job_id malformado e 404 para inexistente", async () => {
    expect((await request(app).get("/api/extract/job/abc").set(auth)).status).toBe(400);
    expect((await request(app).get("/api/extract/job/00000000-0000-4000-8000-000000000000").set(auth)).status).toBe(404);
  });

  it("aliases legados funcionam", async () => {
    const res = await request(app).post("/api/extract/extract-document-async").set(auth).attach("file", path.join(fixtures, "evolucao.txt"));
    expect(res.status).toBe(202);
    const job = await request(app).get(`/api/extract/extract-job/${res.body.job_id}`).set(auth);
    expect([200]).toContain(job.status);
  });
});
