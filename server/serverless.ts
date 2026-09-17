import express from "express";
import helmet from "helmet";
import { authRequired, configErrors, configOk, env, hasOpenAIKey, hasSupabase } from "./config.js";
import { requireAuth } from "./middleware/auth.js";
import { apiNotFound, errorHandler } from "./middleware/errorHandler.js";
import { buildCors, buildRateLimiters } from "./middleware/security.js";
import { aiRouter } from "./routes/ai.routes.js";
import { APP_VERSION } from "./app.js";
import { DEFAULT_MODEL } from "./services/openaiClient.js";

/**
 * A mesma aplicação, sem o que não cabe em função serverless.
 *
 * Só a casca muda: `aiRouter`, os prompts, os schemas Zod e os guardrails
 * clínicos são exatamente os mesmos de `createApp`. O que fica de fora são as
 * rotas que dependem de `multer` com 20 MB e de execução longa — upload de
 * documento e passagem de plantão —, e o servir de arquivo estático, que na
 * Vercel é o próprio CDN.
 */
export function createServerlessApp() {
  const app = express();
  const limiters = buildRateLimiters();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(
    helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } }),
  );
  app.use(buildCors());
  app.use(express.json({ limit: "2mb" }));

  // Sem autenticação de propósito: é o que a faixa de aviso do app consulta
  // para saber se o servidor está de pé. Responde nos dois caminhos porque o
  // contêiner serve /health na raiz e a Vercel reescreve para /api/health.
  const health: express.RequestHandler = (_req, res) => {
    res.status(configOk() ? 200 : 503).json({
      ok: configOk(),
      service: "medfluxo-motor-luan",
      runtime: "vercel-function",
      version: APP_VERSION,
      model: DEFAULT_MODEL,
      hasOpenAIKey: hasOpenAIKey(),
      aiMock: env.AI_MOCK,
      supabase: hasSupabase(),
      authRequired: authRequired(),
      configErrors,
    });
  };
  app.get("/health", health);
  app.get("/api/health", health);

  // Configuração incompleta falha visível, com o motivo. Antes o processo
  // morria calado e o app só via "erro 404" vindo da borda.
  app.use("/api", (_req, res, next) => {
    if (configOk()) return next();
    res.status(503).json({
      error: "config_indisponivel",
      message: "Servidor de IA sem configuração completa.",
      details: configErrors,
    });
  });

  app.use("/api", requireAuth);
  app.use("/api/ai", limiters.ai, aiRouter);

  // Ainda no contêiner (corpo de 20 MB e execução longa não cabem aqui).
  // Melhor dizer isso do que devolver 404 e deixar o app adivinhar.
  app.use(["/api/extract", "/api/passagem-plantao"], (_req, res) => {
    res.status(503).json({
      error: "rota_indisponivel",
      message:
        "Leitura de documento e passagem de plantão ainda não estão disponíveis nesta implantação.",
    });
  });

  app.use("/api", apiNotFound);
  app.use(errorHandler);
  return app;
}
