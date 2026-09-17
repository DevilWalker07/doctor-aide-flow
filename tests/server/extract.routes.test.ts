import fs from "node:fs";
import path from "node:path";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { makeApp, waitFor } from "./helpers/app.js";
import { resetAiMock, storageMock } from "./helpers/mocks.js";

const { app, jobStore } = makeApp();
const auth = { Authorization: "Bearer valid-token" };
const fixtures = path.resolve(__dirname, "../fixtures");
const USER = "user-1";

/**
 * O upload não passa mais pelo servidor: o navegador envia direto ao Supabase
 * Storage e a rota recebe só o caminho. Este helper faz as duas pontas —
 * coloca o conteúdo no bucket e manda o caminho, como o cliente real.
 */
async function createJob(
  file: string | Buffer,
  name?: string,
  opts: { headers?: Record<string, string>; rota?: string; dono?: string } = {},
) {
  const conteudo = typeof file === "string" ? fs.readFileSync(file) : file;
  const fileName = typeof file === "string" ? path.basename(file) : (name ?? "arquivo.bin");
  const storagePath = `${opts.dono ?? USER}/${Date.now()}-${fileName}`;
  storageMock.put(storagePath, conteudo);

  return request(app)
    .post(opts.rota ?? "/api/extract/extract-async")
    .set(opts.headers ?? auth)
    .send({ storage_path: storagePath, file_name: fileName });
}

describe("/api/extract/*", () => {
  beforeEach(() => {
    resetAiMock();
    storageMock.reset();
  });

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
    const utf16 = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from("PACIENTE UTF16\nLEITO L01", "utf16le"),
    ]);
    const res = await createJob(utf16, "windows.txt");
    expect(res.status).toBe(202);
    const job = await waitFor(
      async () => (await request(app).get(`/api/extract/job/${res.body.job_id}`).set(auth)).body,
      (j) => j.status !== "queued" && j.status !== "processing",
    );
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
      const job = await waitFor(
        async () => (await request(app).get(`/api/extract/job/${res.body.job_id}`).set(auth)).body,
        (j) => j.status === "done" || j.status === "error",
      );
      expect(job.status, file).toBe("done");
      expect(job.result.engine).toBe(engine);
    }
  });

  it("sexo nulo na extração vira '' no suggested_patient (nunca 'F' por padrão)", async () => {
    const { aiMock } = await import("./helpers/mocks.js");
    aiMock.json.mockImplementationOnce(async (_s, _p, schema) => ({
      ok: true,
      data: schema.parse({ nome: null, sexo: null, idade: null }),
    }));
    const res = await createJob(path.join(fixtures, "evolucao.txt"));
    const job = await waitFor(
      async () => (await request(app).get(`/api/extract/job/${res.body.job_id}`).set(auth)).body,
      (j) => j.status === "done",
    );
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
    expect(res.body.error).toBe("arquivo_grande");
  });

  it("400 sem storage_path", async () => {
    const res = await request(app).post("/api/extract/extract-async").set(auth).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("missing_storage_path");
  });

  it("403 para caminho na pasta de outro médico", async () => {
    // O backend usa a service role, que ignora RLS — sem esta checagem um
    // storage_path forjado leria o documento de outro.
    const res = await createJob(path.join(fixtures, "evolucao.txt"), undefined, {
      dono: "user-2",
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("forbidden_path");
  });

  it("400 para caminho que tenta escapar da pasta", async () => {
    const res = await request(app)
      .post("/api/extract/extract-async")
      .set(auth)
      .send({ storage_path: "user-1/../user-2/segredo.txt", file_name: "segredo.txt" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_storage_path");
  });

  it("404 quando o caminho não existe no bucket", async () => {
    const res = await request(app)
      .post("/api/extract/extract-async")
      .set(auth)
      .send({ storage_path: `${USER}/nunca-enviado.txt`, file_name: "nunca-enviado.txt" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("arquivo_nao_encontrado");
  });

  it("sem Supabase, preparar-upload manda o arquivo pelo próprio servidor", async () => {
    // É o modo local documentado: `npm run dev:all` sem serviço nenhum.
    const res = await request(app)
      .post("/api/extract/preparar-upload")
      .set(auth)
      .send({ file_name: "evolucao.txt" });
    expect(res.status).toBe(200);
    expect(res.body.modo).toBe("multipart");
  });

  it("com Supabase, devolve caminho dentro da pasta do médico", async () => {
    const { env } = await import("../../server/config.js");
    const original = { url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE_KEY };
    try {
      (env as { SUPABASE_URL?: string }).SUPABASE_URL = "https://exemplo.supabase.co";
      (env as { SUPABASE_SERVICE_ROLE_KEY?: string }).SUPABASE_SERVICE_ROLE_KEY = "chave";

      const res = await request(app)
        .post("/api/extract/preparar-upload")
        .set(auth)
        .send({ file_name: "Evolução do paciente.pdf" });
      expect(res.status).toBe(200);
      expect(res.body.modo).toBe("storage");
      expect(res.body.bucket).toBe("documentos-clinicos");
      expect(res.body.storage_path.startsWith(`${USER}/`)).toBe(true);
      // Nome saneado: acento e espaço não viram caminho.
      expect(res.body.storage_path).toMatch(/Evolucao_do_paciente\.pdf$/);
    } finally {
      (env as { SUPABASE_URL?: string }).SUPABASE_URL = original.url;
      (env as { SUPABASE_SERVICE_ROLE_KEY?: string }).SUPABASE_SERVICE_ROLE_KEY = original.key;
    }
  });

  it("multipart continua funcionando no contêiner", async () => {
    const res = await request(app)
      .post("/api/extract/extract-async")
      .set(auth)
      .attach("file", path.join(fixtures, "evolucao.txt"));
    expect(res.status).toBe(202);
    const job = await waitFor(
      async () => (await request(app).get(`/api/extract/job/${res.body.job_id}`).set(auth)).body,
      (j) => j.status === "done" || j.status === "error",
    );
    expect(job.status).toBe("done");
    expect(job.result.nome).toBe("PACIENTE TESTE E2E");
  });

  it("o documento sai do bucket depois de processado", async () => {
    const res = await createJob(path.join(fixtures, "evolucao.txt"));
    expect(res.status).toBe(202);
    await waitFor(
      async () => (await request(app).get(`/api/extract/job/${res.body.job_id}`).set(auth)).body,
      (j) => j.status === "done" || j.status === "error",
    );
    await waitFor(
      async () => ({ n: storageMock.removidos.length }),
      (v) => v.n > 0,
    );
    expect(storageMock.objetos.size).toBe(0);
  });

  it("job de outro usuário retorna 404", async () => {
    const res = await createJob(path.join(fixtures, "evolucao.txt"));
    const other = await request(app)
      .get(`/api/extract/job/${res.body.job_id}`)
      .set("Authorization", "Bearer other-token");
    expect(other.status).toBe(404);
    const stored = await jobStore.get(res.body.job_id);
    expect(stored?.user_id).toBe("user-1");
  });

  it("400 para job_id malformado e 404 para inexistente", async () => {
    expect((await request(app).get("/api/extract/job/abc").set(auth)).status).toBe(400);
    expect(
      (await request(app).get("/api/extract/job/00000000-0000-4000-8000-000000000000").set(auth))
        .status,
    ).toBe(404);
  });

  it("aliases legados funcionam", async () => {
    const res = await createJob(path.join(fixtures, "evolucao.txt"), undefined, {
      rota: "/api/extract/extract-document-async",
    });
    expect(res.status).toBe(202);
    const job = await request(app).get(`/api/extract/extract-job/${res.body.job_id}`).set(auth);
    expect([200]).toContain(job.status);
  });
});

describe("orçamento de tempo da extração", () => {
  it("job que estoura o tempo vira erro legível em vez de ficar preso", async () => {
    // Em função serverless a plataforma corta a invocação no maxDuration. Sem
    // este limite, o job ficaria em "processing" e a tela de progresso giraria
    // sem fim — o médico esperando por algo que nunca vem.
    const { comOrcamento } = await import("../../server/routes/extract.routes.js");
    const { createMemoryJobStore } = await import("../../server/services/jobStore.js");

    const store = createMemoryJobStore({ ttlMs: 60_000, sweepMs: 60_000 });
    const jobId = "00000000-0000-4000-8000-00000000dead";
    await store.create({ job_id: jobId, user_id: USER, file_name: "lento.pdf" });

    const nuncaTermina = new Promise<void>(() => {});
    await comOrcamento(nuncaTermina, jobId, store, 20);

    const job = await store.get(jobId, USER);
    expect(job?.status).toBe("error");
    expect(job?.error).toMatch(/tempo limite/i);
  });

  it("job que termina antes do limite não é tocado", async () => {
    const { comOrcamento } = await import("../../server/routes/extract.routes.js");
    const { createMemoryJobStore } = await import("../../server/services/jobStore.js");

    const store = createMemoryJobStore({ ttlMs: 60_000, sweepMs: 60_000 });
    const jobId = "00000000-0000-4000-8000-00000000beef";
    await store.create({ job_id: jobId, user_id: USER, file_name: "rapido.txt" });
    await store.update(jobId, { status: "done", stage: "Pronto para revisão" });

    await comOrcamento(Promise.resolve(), jobId, store, 5_000);

    const job = await store.get(jobId, USER);
    expect(job?.status).toBe("done");
  });
});

describe("modelo de visão na extração", () => {
  it("foto usa o modelo de visão; texto extraído segue no padrão", async () => {
    const { aiMock } = await import("./helpers/mocks.js");
    const { modeloVisao } = await import("../../server/config.js");

    // PNG mínimo válido — o que importa é o caminho com imagem, não o conteúdo.
    const png = Buffer.from(
      "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154" +
        "789c6300010000050001+0d0a2db40000000049454e44ae426082".replace("+", ""),
      "hex",
    );

    aiMock.json.mockClear();
    const foto = await createJob(png, "prontuario.png");
    expect(foto.status).toBe(202);
    await waitFor(
      async () => (await request(app).get(`/api/extract/job/${foto.body.job_id}`).set(auth)).body,
      (j) => j.status === "done" || j.status === "error",
    );
    const optsFoto = aiMock.json.mock.calls.at(-1)?.[3];
    expect(optsFoto?.images?.length).toBeGreaterThan(0);
    expect(optsFoto?.modelo).toBe(modeloVisao());

    aiMock.json.mockClear();
    const txt = await createJob(path.join(fixtures, "evolucao.txt"));
    await waitFor(
      async () => (await request(app).get(`/api/extract/job/${txt.body.job_id}`).set(auth)).body,
      (j) => j.status === "done" || j.status === "error",
    );
    const optsTxt = aiMock.json.mock.calls.at(-1)?.[3];
    expect(optsTxt?.images).toBeUndefined();
    // Sem imagem não há por que pagar modelo de visão.
    expect(optsTxt?.modelo).toBeUndefined();
  });
});
