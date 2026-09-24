import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import { authRequired, env, hasOpenAIKey, modelosEmUso, STATIC_DIR } from "./config.js";
import { requireAuth } from "./middleware/auth.js";
import { apiNotFound, errorHandler } from "./middleware/errorHandler.js";
import { buildCors, buildRateLimiters } from "./middleware/security.js";
import { aiRouter } from "./routes/ai.routes.js";
import { createExtractRouter } from "./routes/extract.routes.js";
import { createPassagemPlantaoRouter } from "./routes/passagemPlantao.routes.js";
import { sondarSupabase } from "./lib/supabaseAdmin.js";
import { getJobStore, type JobStore } from "./services/jobStore.js";
import { modelosDesconhecidos } from "./services/openaiClient.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function readVersion(): string {
  for (const candidate of ["../package.json", "../../package.json"]) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.resolve(here, candidate), "utf-8"));
      if (pkg?.version) return String(pkg.version);
    } catch {
      /* try next */
    }
  }
  return "0.0.0";
}

export const APP_VERSION = readVersion();

export interface AppDeps {
  jobStore?: JobStore;
}

export function createApp(deps: AppDeps = {}) {
  const app = express();
  const jobStore = deps.jobStore ?? getJobStore();
  const limiters = buildRateLimiters();
  const startedAt = Date.now();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(
    helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } }),
  );
  app.use(buildCors());
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", async (_req, res) => {
    res.json({
      ok: true,
      service: "doutor-ajuda-motor-luan",
      version: APP_VERSION,
      modelos: modelosEmUso(),
      modelosDesconhecidos: await modelosDesconhecidos(Object.values(modelosEmUso())),
      hasOpenAIKey: hasOpenAIKey(),
      aiMock: env.AI_MOCK,
      jobStore: jobStore.kind,
      supabase: await sondarSupabase(),
      authRequired: authRequired(),
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    });
  });

  app.use("/api", requireAuth);
  app.use("/api/ai", limiters.ai, aiRouter);
  // O contêiner aceita multipart: é o modo local (`npm run dev:all` sem
  // Supabase) e é como os testes e2e rodam.
  app.use("/api/extract", createExtractRouter({ jobStore, limiters, permitirMultipart: true }));
  // O contêiner aceita os dois: multipart (modo local, sem Supabase) e o job
  // assíncrono a partir do Storage.
  app.use(
    "/api/passagem-plantao",
    limiters.passagem,
    createPassagemPlantaoRouter({ jobStore, permitirMultipart: true }),
  );
  app.use("/api", apiNotFound);

  if (fs.existsSync(STATIC_DIR)) {
    app.use(express.static(STATIC_DIR, { index: false, maxAge: "1h" }));
    app.get("/{*splat}", (_req, res) => {
      res.sendFile(path.join(STATIC_DIR, "index.html"));
    });
  } else {
    app.get("/{*splat}", (_req, res) => {
      res.status(404).type("text").send("Frontend não compilado. Execute 'npm run build'.");
    });
  }

  app.use(errorHandler);
  return app;
}
