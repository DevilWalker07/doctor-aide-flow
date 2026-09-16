import type { ErrorRequestHandler, RequestHandler } from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";
import { HttpError } from "../lib/errors.js";

export const apiNotFound: RequestHandler = (req, res) => {
  res
    .status(404)
    .json({ error: "not_found", message: `Rota ${req.method} ${req.path} não existe.` });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (res.headersSent) return;

  if (err instanceof MulterError) {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    res.status(status).json({ error: "upload_error", message: err.message });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: "validation",
      message: "Dados inválidos.",
      issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
    return;
  }

  if (err instanceof HttpError) {
    const body: Record<string, unknown> = { error: err.code, message: err.message };
    if (err.details !== undefined) body.details = err.details;
    res.status(err.status).json(body);
    return;
  }

  if (err instanceof Error && err.message.startsWith("Arquivo não suportado")) {
    res.status(415).json({ error: "unsupported_format", message: err.message });
    return;
  }

  console.error("[errorHandler] erro não tratado:", err);
  res.status(500).json({ error: "internal", message: "Erro interno no servidor." });
};
