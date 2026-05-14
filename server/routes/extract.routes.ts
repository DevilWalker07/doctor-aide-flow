import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import os from "os";
import crypto from "crypto";
import { JOBS, processFileInBackground, type JobState } from "../services/documentExtractor.service.js";

export const extractRouter = Router();

// ─── Multer configuration (disk storage in temp dir) ─────────────────────────
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif",
      "image/heic", "image/heif",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain", "text/markdown",
    ];
    // Also allow by extension when MIME is wrong (common with HEIC)
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif",
      ".pdf", ".doc", ".docx", ".txt", ".md"];
    if (allowed.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de arquivo não suportado: ${file.mimetype} (${ext})`));
    }
  },
});

// ─── POST /extract-async ─────────────────────────────────────────────────────
extractRouter.post("/extract-async", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Nenhum arquivo enviado. Use multipart/form-data com o campo 'file'." });
      return;
    }

    const jobId = crypto.randomUUID();
    const now = new Date().toISOString();

    const initialState: JobState = {
      job_id: jobId,
      status: "queued",
      stage: "Arquivo recebido",
      error: null,
      createdAt: now,
    };

    JOBS.set(jobId, initialState);

    // Fire and forget — do NOT await
    setImmediate(() => {
      processFileInBackground(jobId, req.file!.path, req.file!.originalname);
    });

    res.json({ job_id: jobId, status: "queued", stage: "Arquivo recebido" });
  } catch (err: any) {
    console.error("[extractRouter] POST /extract-async error:", err);
    res.status(500).json({ error: err?.message || "Erro interno ao criar job." });
  }
});

// Alias for compatibility
extractRouter.post("/extract-document-async", upload.single("file"), async (req: Request, res: Response) => {
  // Forward to same logic by re-routing internally
  if (!req.file) {
    res.status(400).json({ error: "Nenhum arquivo enviado." });
    return;
  }

  const jobId = crypto.randomUUID();
  const now = new Date().toISOString();

  JOBS.set(jobId, {
    job_id: jobId,
    status: "queued",
    stage: "Arquivo recebido",
    error: null,
    createdAt: now,
  });

  setImmediate(() => {
    processFileInBackground(jobId, req.file!.path, req.file!.originalname);
  });

  res.json({ job_id: jobId, status: "queued", stage: "Arquivo recebido" });
});

// ─── GET /job/:jobId ──────────────────────────────────────────────────────────
extractRouter.get("/job/:jobId", (req: Request, res: Response) => {
  const job = JOBS.get(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: "Job não encontrado. Pode ter expirado.", job_id: req.params.jobId });
    return;
  }
  res.json(job);
});

// Alias for compatibility
extractRouter.get("/extract-job/:jobId", (req: Request, res: Response) => {
  const job = JOBS.get(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: "Job não encontrado.", job_id: req.params.jobId });
    return;
  }
  res.json(job);
});
