import os from "node:os";
import path from "node:path";
import { Router, type RequestHandler } from "express";
import multer from "multer";
import { HttpError } from "../lib/errors.js";
import { safeUnlink, sanitizeFilename } from "../lib/files.js";
import { PassagemBodySchema } from "../schemas/ai.schemas.js";
import { gerarMapaPlantaoDocx } from "../services/docxGenerator.service.js";
import { gerarMapaPlantao, type EvolucaoInput } from "../services/passagemPlantao.service.js";
import { extractTextFromFile } from "../services/textExtraction.service.js";

export const passagemPlantaoRouter = Router();

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

const gerar: RequestHandler = async (req, res) => {
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

  const docxBuffer = await gerarMapaPlantaoDocx(result.data, setor, data);
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

passagemPlantaoRouter.post("/gerar", upload.array("files", MAX_FILES), gerar);

passagemPlantaoRouter.get("/health", (_req, res) => {
  res.json({ ok: true, endpoint: "passagem-plantao", maxFiles: MAX_FILES });
});
