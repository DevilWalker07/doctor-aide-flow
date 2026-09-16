import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import { authRequired, env, hasOpenAIKey, hasSupabase, STATIC_DIR } from "./config.js";
import { requireAuth } from "./middleware/auth.js";
import { apiNotFound, errorHandler } from "./middleware/errorHandler.js";
import { buildCors, buildRateLimiters } from "./middleware/security.js";
import { aiRouter } from "./routes/ai.routes.js";
import { createExtractRouter } from "./routes/extract.routes.js";
import { passagemPlantaoRouter } from "./routes/passagemPlantao.routes.js";
import { getJobStore, type JobStore } from "./services/jobStore.js";
import { DEFAULT_MODEL } from "./services/openaiClient.js";

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

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "doutor-ajuda-motor-luan",
      version: APP_VERSION,
      model: DEFAULT_MODEL,
      hasOpenAIKey: hasOpenAIKey(),
      aiMock: env.AI_MOCK,
      jobStore: jobStore.kind,
      supabase: hasSupabase(),
      authRequired: authRequired(),
      uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    });
  });

  app.use("/api", requireAuth);
  app.use("/api/ai", limiters.ai, aiRouter);
  app.use("/api/extract", createExtractRouter({ jobStore, limiters }));
  app.use("/api/passagem-plantao", limiters.passagem, passagemPlantaoRouter);
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
