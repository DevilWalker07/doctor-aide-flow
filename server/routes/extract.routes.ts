import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { Router, type RequestHandler } from "express";
import multer from "multer";
import { extractBudgetMs, hasSupabase } from "../config.js";
import { HttpError } from "../lib/errors.js";
import { safeUnlink, sniffKind } from "../lib/files.js";
import {
  apagarDoBucket,
  baixarParaTemporario,
  montarCaminho,
  validarCaminho,
  BUCKET_DOCUMENTOS,
} from "../lib/storageDocumentos.js";
import { processFileInBackground } from "../services/documentExtractor.service.js";
import { toPublicJob, type JobStore } from "../services/jobStore.js";

export interface ExtractRouterDeps {
  jobStore: JobStore;
  limiters: { upload: RequestHandler; poll: RequestHandler };
  /**
   * Aceitar upload multipart pelo servidor.
   *
   * Só o contêiner: é o modo local documentado (`npm run dev:all` com
   * `AUTH_OPTIONAL=true`, sem Supabase nenhum) e é como os testes e2e rodam.
   * A função serverless não liga isso — 20 MB não passam pelo corpo dela.
   */
  permitirMultipart?: boolean;
  /**
   * Prolonga a invocação além da resposta HTTP.
   *
   * Em contêiner não é preciso: o processo continua vivo e um `void promise`
   * basta. Em função serverless, tudo que roda depois da resposta é
   * interrompido — o job ficaria preso em "processing" e a tela de progresso
   * giraria sem fim. `api/[...rota].ts` injeta o `waitUntil` da Vercel aqui.
   */
  manterVivo?: (promise: Promise<unknown>) => void;
}

/** Marca o job como erro em vez de deixá-lo preso quando o tempo estoura. */
export async function comOrcamento(
  trabalho: Promise<void>,
  jobId: string,
  store: JobStore,
  budgetMs: number,
): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const estouro = new Promise<"estourou">((resolve) => {
    timer = setTimeout(() => resolve("estourou"), budgetMs);
  });

  try {
    const resultado = await Promise.race([trabalho.then(() => "terminou" as const), estouro]);
    if (resultado === "estourou") {
      await store.update(jobId, {
        status: "error",
        stage: "Erro na extração",
        error:
          "A leitura passou do tempo limite. Tente um arquivo menor, ou fotografe " +
          "só a página que importa.",
      });
    }
  } finally {
    clearTimeout(timer);
  }
}

const EXTENSOES_MULTIPART = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
  ".pdf",
  ".docx",
  ".txt",
  ".md",
]);

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (EXTENSOES_MULTIPART.has(ext)) cb(null, true);
    else
      cb(new Error(`Arquivo não suportado: ${file.originalname}. Use imagem, PDF, DOCX ou TXT.`));
  },
});

export function createExtractRouter({
  jobStore,
  limiters,
  manterVivo,
  permitirMultipart = false,
}: ExtractRouterDeps) {
  const router = Router();
  const agendar = manterVivo ?? ((p: Promise<unknown>) => void p);

  /**
   * Diz ao navegador para onde enviar o arquivo.
   *
   * O upload não passa mais pelo servidor: o arquivo vai direto ao Supabase
   * Storage com a sessão do próprio médico. Isso existe porque função
   * serverless tem limite de corpo muito abaixo dos 20 MB que a tela aceita —
   * e, de quebra, o documento deixa de trafegar duas vezes.
   */
  const prepararUpload: RequestHandler = (req, res) => {
    const fileName = String((req.body as { file_name?: unknown })?.file_name ?? "documento");

    // Sem Supabase (modo local) ou sem sessão, o envio direto não tem para onde
    // ir — e aí o contêiner recebe o arquivo pelo próprio servidor. Dizer o
    // modo aqui evita o cliente adivinhar e falhar no meio do upload.
    if (!hasSupabase() || !req.userId) {
      if (!permitirMultipart) {
        throw new HttpError(
          401,
          "unauthorized",
          "Envio de documento exige sessão. Entre na sua conta e tente novamente.",
        );
      }
      res.json({ modo: "multipart" as const });
      return;
    }

    res.json({
      modo: "storage" as const,
      bucket: BUCKET_DOCUMENTOS,
      storage_path: montarCaminho(req.userId, fileName),
    });
  };

  const createJob: RequestHandler = async (req, res) => {
    const corpo = (req.body ?? {}) as { storage_path?: unknown; file_name?: unknown };
    const storagePath = validarCaminho(corpo.storage_path, req.userId);
    const fileName =
      typeof corpo.file_name === "string" && corpo.file_name.trim()
        ? corpo.file_name.trim()
        : storagePath.split("/").pop()!;

    const { filePath } = await baixarParaTemporario(storagePath);

    // Continua valendo a checagem por magic bytes: extensão mente, e o bucket
    // aceita o mime que o navegador declarou.
    const kind = await sniffKind(filePath, fileName);
    if (kind === "unknown") {
      await safeUnlink(filePath);
      await apagarDoBucket(storagePath);
      throw new HttpError(
        415,
        "unsupported_format",
        `Conteúdo de ${fileName} não corresponde a um formato suportado.`,
      );
    }

    const job = await iniciar(filePath, fileName, req.userId, storagePath);
    res.status(202).json({ job_id: job.job_id, status: job.status, stage: job.stage });
  };

  /** Cria o job e agenda o processamento. Igual nos dois modos de envio. */
  async function iniciar(
    filePath: string,
    fileName: string,
    userId: string | null,
    storagePath: string | null,
  ) {
    const jobId = crypto.randomUUID();
    const job = await jobStore.create({
      job_id: jobId,
      user_id: userId,
      file_name: fileName,
    });

    const trabalho = processFileInBackground({
      jobId,
      filePath,
      originalName: fileName,
      store: jobStore,
    })
      .catch((err) => {
        console.error(`[extract] job ${jobId} rejeitado fora do handler:`, err);
        return jobStore.update(jobId, {
          status: "error",
          stage: "Erro na extração",
          error: "Falha inesperada no processamento.",
        });
      })
      .then(() => void 0);

    agendar(
      comOrcamento(trabalho, jobId, jobStore, extractBudgetMs())
        // O documento sai do bucket depois de processado: o app precisa do
        // resultado da extração, não do arquivo do paciente.
        .finally(() => (storagePath ? apagarDoBucket(storagePath) : Promise.resolve())),
    );

    return job;
  }

  /** Recebe o arquivo pelo próprio servidor. Só no contêiner. */
  const createJobMultipart: RequestHandler = async (req, res) => {
    const file = req.file;
    if (!file) {
      throw new HttpError(
        400,
        "missing_file",
        "Nenhum arquivo enviado. Use multipart/form-data com o campo 'file'.",
      );
    }

    const kind = await sniffKind(file.path, file.originalname);
    if (kind === "unknown") {
      await safeUnlink(file.path);
      throw new HttpError(
        415,
        "unsupported_format",
        `Conteúdo de ${file.originalname} não corresponde a um formato suportado.`,
      );
    }

    const job = await iniciar(file.path, file.originalname, req.userId, null);
    res.status(202).json({ job_id: job.job_id, status: job.status, stage: job.stage });
  };

  const getJob: RequestHandler = async (req, res) => {
    const jobId = String(req.params.jobId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(jobId))
      throw new HttpError(400, "invalid_job_id", "job_id inválido.");

    const job = await jobStore.get(jobId, req.userId);
    if (!job) throw new HttpError(404, "job_not_found", "Job não encontrado. Pode ter expirado.");

    res.set("Cache-Control", "no-store");
    res.json(toPublicJob(job));
  };

  router.post("/preparar-upload", limiters.upload, prepararUpload);
  if (permitirMultipart) {
    router.post(
      ["/extract-async", "/extract-document-async"],
      limiters.upload,
      (req, res, next) => {
        // JSON com storage_path segue pelo caminho do Storage; multipart cai no
        // multer. Um só endpoint, para o cliente não ter duas URLs.
        if (req.is("multipart/form-data")) return upload.single("file")(req, res, next);
        next();
      },
      (req, res, next) =>
        req.file ? createJobMultipart(req, res, next) : createJob(req, res, next),
    );
  } else {
    router.post(["/extract-async", "/extract-document-async"], limiters.upload, createJob);
  }
  router.get(["/job/:jobId", "/extract-job/:jobId"], limiters.poll, getJob);

  return router;
}
