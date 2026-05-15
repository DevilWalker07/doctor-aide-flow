import "dotenv/config";
import express from "express";
import cors from "cors";
import { aiRouter } from "./routes/ai.routes.js";
import { extractRouter } from "./routes/extract.routes.js";
import { DEFAULT_MODEL, hasOpenAIKey } from "./services/openaiClient.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Serve static files from the 'dist' directory
const distPath = path.join(__dirname, "../dist");
app.use(express.static(distPath));

// Handle SPA routing - serve index.html for all non-API routes.
app.use((req, res, next) => {
  // If it's an API route that reached here, it's a 404 for the API
  if (req.path.startsWith("/api") || req.path.startsWith("/health")) {
    return next();
  }
  
  // Serve the frontend index.html for all other routes (SPA)
  res.sendFile(path.join(distPath, "index.html"), (err) => {
    if (err) {
      // If the frontend isn't built yet, provide a helpful message
      res.status(404).send("Frontend assets not found. Please run 'npm run build' first.");
    }
  });
});

app.listen(port, () => {
  console.log(`DOUTOR AJUDA Motor Luan v0.2.1 listening on http://localhost:${port}`);
});
