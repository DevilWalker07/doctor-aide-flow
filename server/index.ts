import "dotenv/config";
import express from "express";
import cors from "cors";
import { aiRouter } from "./routes/ai.routes.js";
import { extractRouter } from "./routes/extract.routes.js";
import { DEFAULT_MODEL, hasOpenAIKey } from "./services/openaiClient.js";

const app = express();
const port = Number(process.env.PORT || 8787);

app.use(cors({ origin: true }));
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "doutor-ajuda-motor-luan",
    version: "0.2.1",
    hasOpenAIKey: hasOpenAIKey(),
    model: DEFAULT_MODEL,
    endpoints: [
      "/api/ai/orquestrador",
      "/api/ai/extrair-clinica-medica",
      "/api/ai/extrair-pediatria",
      "/api/ai/extrair-uti",
      "/api/ai/gerar-evolucao",
      "/api/ai/importar-evolucoes-ontem",
      "/api/ai/gerar-mapa-plantao",
      "/api/ai/gerar-briefing",
      "/api/extract/extract-async",
      "/api/extract/job/:jobId",
      "/api/extract/extract-document-async",
      "/api/extract/extract-job/:jobId",
    ],
  });
});

app.use("/api/ai", aiRouter);
app.use("/api/extract", extractRouter);

app.listen(port, () => {
  console.log(`DOUTOR AJUDA Motor Luan v0.2.1 listening on http://localhost:${port}`);
});
