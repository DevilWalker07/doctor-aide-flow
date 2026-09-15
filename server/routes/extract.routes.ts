import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { Router, type RequestHandler } from "express";
import multer from "multer";
import { HttpError } from "../lib/errors.js";
import { safeUnlink, sniffKind } from "../lib/files.js";
import { processFileInBackground } from "../services/documentExtractor.service.js";
import { toPublicJob, type JobStore } from "../services/jobStore.js";

const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".pdf", ".docx", ".txt", ".md"]);

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTS.has(ext)) cb(null, true);
    else cb(new Error(`Arquivo não suportado: ${file.originalname}. Use imagem, PDF, DOCX ou TXT.`));
  },
});

export interface ExtractRouterDeps {
  jobStore: JobStore;
  limiters: { upload: RequestHandler; poll: RequestHandler };
}

export function createExtractRouter({ jobStore, limiters }: ExtractRouterDeps) {
  const router = Router();

  const createJob: RequestHandler = async (req, res) => {
    const file = req.file;
    if (!file) throw new HttpError(400, "missing_file", "Nenhum arquivo enviado. Use multipart/form-data com o campo 'file'.");

    const kind = await sniffKind(file.path, file.originalname);
    if (kind === "unknown") {
      await safeUnlink(file.path);
      throw new HttpError(415, "unsupported_format", `Conteúdo de ${file.originalname} não corresponde a um formato suportado.`);
    }

    const jobId = crypto.randomUUID();
    const job = await jobStore.create({ job_id: jobId, user_id: req.userId, file_name: file.originalname });

    void processFileInBackground({ jobId, filePath: file.path, originalName: file.originalname, store: jobStore }).catch(
      (err) => {
        console.error(`[extract] job ${jobId} rejeitado fora do handler:`, err);
        return jobStore.update(jobId, { status: "error", stage: "Erro na extração", error: "Falha inesperada no processamento." });
      },
    );

    res.status(202).json({ job_id: job.job_id, status: job.status, stage: job.stage });
  };

  const getJob: RequestHandler = async (req, res) => {
    const jobId = String(req.params.jobId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(jobId)) throw new HttpError(400, "invalid_job_id", "job_id inválido.");

    const job = await jobStore.get(jobId, req.userId);
    if (!job) throw new HttpError(404, "job_not_found", "Job não encontrado. Pode ter expirado.");

    res.set("Cache-Control", "no-store");
    res.json(toPublicJob(job));
  };

  router.post(["/extract-async", "/extract-document-async"], limiters.upload, upload.single("file"), createJob);
  router.get(["/job/:jobId", "/extract-job/:jobId"], limiters.poll, getJob);

  return router;
}
