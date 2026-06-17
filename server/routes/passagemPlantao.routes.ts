import { Router, Request, Response } from "express";
import multer from "multer";
import os from "os";
import path from "path";
import fs from "fs";
import { PASSAGEM_PLANTAO_BATCH_PROMPT } from "../prompts/passagemPlantaoBatch.prompt.js";
import { jsonCompletion } from "../services/openaiClient.js";
import { gerarMapaPlantaoDocx, type MapaPlantaoData } from "../services/docxGenerator.service.js";

export const passagemPlantaoRouter = Router();

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = [".doc", ".docx", ".txt", ".pdf"];
    const allowedMimes = [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
      "application/pdf",
    ];
    if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Arquivo não suportado: ${file.originalname}`));
    }
  },
});

async function extractTextFromFile(filePath: string, originalName: string): Promise<string> {
  const ext = path.extname(originalName).toLowerCase();

  if (ext === ".docx" || ext === ".doc") {
    const mammoth = (await import("mammoth")).default;
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  if (ext === ".txt") {
    return fs.readFileSync(filePath, "utf-8");
  }

  if (ext === ".pdf") {
    // Basic fallback for PDFs — try to read as text
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return content;
    } catch {
      return `[Arquivo PDF: ${originalName} — conteúdo não extraído automaticamente]`;
    }
  }

  return `[Arquivo: ${originalName}]`;
}

// POST /api/passagem-plantao/gerar
// Accepts: multipart with fields `setor`, `data`, and up to 30 files in field `files`
passagemPlantaoRouter.post(
  "/gerar",
  upload.array("files", 30),
  async (req: Request, res: Response): Promise<void> => {
    const files = req.files as Express.Multer.File[];
    const setor = (req.body.setor as string) || "CMF/CMM";
    const dataPlantao = (req.body.data as string) || new Date().toLocaleDateString("pt-BR");

    if (!files || files.length === 0) {
      res.status(400).json({ error: "Nenhum arquivo enviado. Envie ao menos um arquivo DOCX." });
      return;
    }

    const extractedTexts: string[] = [];
    const fileErrors: string[] = [];

    for (const file of files) {
      try {
        const text = await extractTextFromFile(file.path, file.originalname);
        if (text.trim()) {
          extractedTexts.push(`=== ARQUIVO: ${file.originalname} ===\n${text.trim()}`);
        } else {
          fileErrors.push(`${file.originalname}: nenhum texto extraído`);
        }
      } catch (err: any) {
        fileErrors.push(`${file.originalname}: ${err?.message || "erro na extração"}`);
      } finally {
        try { fs.unlinkSync(file.path); } catch { /* ignore */ }
      }
    }

    if (extractedTexts.length === 0) {
      res.status(422).json({
        error: "Não foi possível extrair texto de nenhum arquivo.",
        detalhes: fileErrors,
      });
      return;
    }

    const userPayload = {
      setor,
      data: dataPlantao,
      total_leitos: extractedTexts.length,
      evolucoes: extractedTexts.join("\n\n"),
    };

    const aiResult = await jsonCompletion(PASSAGEM_PLANTAO_BATCH_PROMPT, userPayload) as MapaPlantaoData | null;

    if (!aiResult || !Array.isArray(aiResult.pacientes)) {
      res.status(500).json({ error: "A IA não retornou dados estruturados válidos." });
      return;
    }

    if (!Array.isArray(aiResult.alertasCriticos)) {
      aiResult.alertasCriticos = [];
    }

    try {
      const docxBuffer = await gerarMapaPlantaoDocx(aiResult, setor, dataPlantao);
      const filename = `MAPA_PASSAGEM_${setor.replace(/\//g, "-")}_${dataPlantao.replace(/\//g, "_")}.docx`;

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("X-Pacientes-Count", String(aiResult.pacientes.length));
      res.setHeader("X-Alertas-Count", String(aiResult.alertasCriticos.length));
      if (fileErrors.length > 0) {
        res.setHeader("X-File-Warnings", fileErrors.join("; ").substring(0, 500));
      }

      res.send(docxBuffer);
    } catch (err: any) {
      console.error("[passagemPlantao] Erro ao gerar DOCX:", err);
      res.status(500).json({ error: "Erro ao gerar o documento DOCX.", detalhes: err?.message });
    }
  }
);

// GET /api/passagem-plantao/health
passagemPlantaoRouter.get("/health", (_req, res) => {
  res.json({ ok: true, endpoint: "passagem-plantao" });
});
