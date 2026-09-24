import os from "node:os";
import path from "node:path";
import { Router, type RequestHandler } from "express";
import multer from "multer";
import { HttpError } from "../lib/errors.js";
import { safeUnlink, sanitizeFilename } from "../lib/files.js";
import { PassagemBodySchema } from "../schemas/ai.schemas.js";
import { gerarMapaPlantaoDocx } from "../services/docxGenerator.service.js";
import { gerarMapaPlantao, type EvolucaoInput } from "../services/passagemPlantao.service.js";
import type { JobStore } from "../services/jobStore.js";
import {
  ehEstadoPassagem,
  iniciarPassagem,
  processarAteOFim,
} from "../services/passagemJob.service.js";
import { urlAssinada } from "../lib/storageDocumentos.js";
import { extractTextFromFile } from "../services/textExtraction.service.js";

export interface PassagemRouterDeps {
  jobStore: JobStore;
  /** Prolonga a invocação além da resposta 202. Ver server/serverless.ts. */
  manterVivo?: (promise: Promise<unknown>) => void;
  /** Só o contêiner: 15 arquivos não cabem no corpo de uma função serverless. */
  permitirMultipart?: boolean;
}

const ALLOWED_EXTS = new Set([".docx", ".txt", ".md", ".pdf"]);
const MAX_FILES = 30;

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 20 * 1024 * 1024, files: MAX_FILES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTS.has(ext)) cb(null, true);
    else cb(new Error(`Arquivo não suportado: ${file.originalname}. Use DOCX, PDF ou TXT.`));
  },
});

export function createPassagemPlantaoRouter({
  jobStore,
  manterVivo,
  permitirMultipart = false,
}: PassagemRouterDeps) {
  const router = Router();
  const agendar = manterVivo ?? ((p: Promise<unknown>) => void p);

  /**
   * Começa a passagem a partir de arquivos já no Storage.
   *
   * Devolve 202 e um job. O processamento vai lote a lote, porque o teto de
   * 60 s por invocação no plano hobby não comporta 15 arquivos de uma vez — e
   * requisição que estoura o teto deixa o médico sem nada.
   */
  const iniciar: RequestHandler = async (req, res) => {
    const corpo = (req.body ?? {}) as { storage_paths?: unknown };
    const caminhos = Array.isArray(corpo.storage_paths) ? corpo.storage_paths.map(String) : [];
    if (caminhos.length === 0) {
      throw new HttpError(400, "missing_files", "Nenhum arquivo enviado.");
    }
    if (caminhos.length > MAX_FILES) {
      throw new HttpError(400, "too_many_files", `No máximo ${MAX_FILES} arquivos por vez.`);
    }
    const corpoValidado = PassagemBodySchema.parse(req.body ?? {});
    const { setor, data } = corpoValidado;

    const inicio = await iniciarPassagem({
      storagePaths: caminhos,
      setor,
      data,
      cabecalho: {
        hospital: corpoValidado.hospital,
        periodo: corpoValidado.periodo,
        passagemPara: corpoValidado.passagem_para,
      },
      userId: req.userId,
      jobStore,
    });

    agendar(
      processarAteOFim(inicio.jobId, jobStore).catch(async (err: unknown) => {
        console.error(`[passagem] job ${inicio.jobId} falhou:`, err);
        await jobStore.update(inicio.jobId, {
          status: "error",
          stage: "Erro na passagem",
          error: err instanceof Error ? err.message : "Falha inesperada.",
        });
      }),
    );

    res.status(202).json({
      job_id: inicio.jobId,
      lotes: inicio.lotes,
      arquivos: inicio.arquivos,
      warnings: inicio.warnings,
    });
  };

  /** Andamento do job, e o link do DOCX quando fica pronto. */
  const consultar: RequestHandler = async (req, res) => {
    const jobId = String(req.params.jobId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(jobId)) {
      throw new HttpError(400, "invalid_job_id", "job_id inválido.");
    }
    const job = await jobStore.get(jobId, req.userId);
    if (!job) throw new HttpError(404, "job_not_found", "Job não encontrado. Pode ter expirado.");

    const estado = ehEstadoPassagem(job.result) ? job.result : null;
    res.set("Cache-Control", "no-store");
    res.json({
      job_id: job.job_id,
      status: job.status,
      stage: job.stage,
      error: job.error,
      lotes: estado ? estado.lotes.length || estado.proximo : 0,
      lote_atual: estado?.proximo ?? 0,
      warnings: estado?.warnings ?? [],
      contagem: estado?.contagem ?? null,
      docx: estado?.docx
        ? { nome: estado.docx.nome, url: await urlAssinada(estado.docx.caminho) }
        : null,
    });
  };

  if (permitirMultipart) {
    // Um endereço só, dois envios. Multipart cai no caminho síncrono que o
    // contêiner sempre teve — é o que os testes provam e o que roda no
    // `npm run dev:all` sem Supabase. JSON com storage_paths vira job.
    router.post(
      "/gerar",
      (req, res, next) => {
        if (req.is("multipart/form-data")) return upload.array("files", MAX_FILES)(req, res, next);
        next();
      },
      (req, res, next) => {
        const temArquivos = Array.isArray(req.files) && req.files.length > 0;
        return temArquivos ? gerarSincrono(req, res, next) : iniciar(req, res, next);
      },
    );
  } else {
    router.post("/gerar", iniciar);
  }

  router.get("/job/:jobId", consultar);

  router.get("/health", (_req, res) => {
    res.json({ ok: true, endpoint: "passagem-plantao", maxFiles: MAX_FILES });
  });

  return router;
}

/** Caminho síncrono do contêiner: devolve o DOCX na própria resposta. */
const gerarSincrono: RequestHandler = async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    throw new HttpError(
      400,
      "missing_files",
      "Nenhum arquivo enviado. Envie ao menos um arquivo DOCX.",
    );
  }

  let body;
  try {
    body = PassagemBodySchema.parse(req.body ?? {});
  } catch (err) {
    await Promise.all(files.map((f) => safeUnlink(f.path)));
    throw err;
  }
  const { setor, data } = body;

  const extracted = await Promise.allSettled(
    files.map(async (file) => {
      try {
        return await extractTextFromFile(file.path, file.originalname);
      } finally {
        await safeUnlink(file.path);
      }
    }),
  );

  const items: EvolucaoInput[] = [];
  const warnings: string[] = [];
  extracted.forEach((r, i) => {
    const name = files[i].originalname;
    if (r.status === "rejected") {
      const reason = r.reason instanceof Error ? r.reason.message : "erro na extração";
      warnings.push(`${name}: ${reason}`);
      return;
    }
    if (r.value.aviso) warnings.push(r.value.aviso);
    const text = r.value.text.trim();
    if (!text) {
      warnings.push(
        `${name}: ${r.value.kind === "pdf" ? "PDF sem texto selecionável" : "nenhum texto extraído"}`,
      );
      return;
    }
    items.push({ fileName: name, text });
  });

  if (items.length === 0) {
    throw new HttpError(
      422,
      "no_text",
      "Não foi possível extrair texto de nenhum arquivo.",
      warnings,
    );
  }

  const result = await gerarMapaPlantao(items, setor, data);
  warnings.push(...result.warnings);

  if (result.batchesFailed === result.batchesTotal) {
    throw new HttpError(
      502,
      "ai_invalid_response",
      "A IA não retornou dados estruturados válidos.",
      warnings,
    );
  }

  const docxBuffer = await gerarMapaPlantaoDocx(result.data, setor, data, {
    hospital: body.hospital,
    periodo: body.periodo,
    passagemPara: body.passagem_para,
  });
  const filename = sanitizeFilename(`MAPA_PASSAGEM_${setor}_${data.replace(/\//g, "-")}.docx`);

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", String(docxBuffer.length));
  res.setHeader("X-Pacientes-Count", String(result.data.pacientes.length));
  res.setHeader("X-Alertas-Count", String(result.data.alertasCriticos.length));
  res.setHeader("X-Batches-Failed", String(result.batchesFailed));
  if (warnings.length > 0) {
    res.setHeader("X-File-Warnings", encodeURIComponent(warnings.join("; ")).slice(0, 1500));
  }
  res.send(docxBuffer);
};
