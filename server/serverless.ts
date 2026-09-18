import { waitUntil } from "@vercel/functions";
import express from "express";
import helmet from "helmet";
import {
  authRequired,
  configErrors,
  configOk,
  env,
  hasOpenAIKey,
  hasSupabase,
  modelosEmUso,
} from "./config.js";
import { requireAuth } from "./middleware/auth.js";
import { apiNotFound, errorHandler } from "./middleware/errorHandler.js";
import { buildCors, buildRateLimiters } from "./middleware/security.js";
import { aiRouter } from "./routes/ai.routes.js";
import { createExtractRouter } from "./routes/extract.routes.js";
import { createPassagemPlantaoRouter } from "./routes/passagemPlantao.routes.js";
import { getJobStore } from "./services/jobStore.js";
import { modelosDesconhecidos } from "./services/openaiClient.js";
import { APP_VERSION } from "./app.js";

/**
 * A mesma aplicação, sem o que não cabe em função serverless.
 *
 * Só a casca muda: `aiRouter`, os prompts, os schemas Zod e os guardrails
 * clínicos são exatamente os mesmos de `createApp`. O que fica de fora são as
 * rotas que dependem de `multer` com 20 MB e de execução longa — upload de
 * documento e passagem de plantão —, e o servir de arquivo estático, que na
 * Vercel é o próprio CDN.
 */
/**
 * Os dois módulos nativos carregam nesta função?
 *
 * `sharp` normaliza imagem e HEIC; `@napi-rs/canvas` só é usado no OCR de PDF
 * escaneado. Empacotamento de binário nativo em função serverless é o tipo de
 * coisa que falha em produção e em nenhum teste — então o /health responde,
 * e eu descubro pelo endpoint em vez de pelo médico.
 */
let nativosPromise: Promise<{ sharp: boolean; canvas: boolean }> | null = null;

function checarNativos() {
  if (!nativosPromise) {
    nativosPromise = Promise.all([
      import("sharp").then(
        () => true,
        () => false,
      ),
      import("@napi-rs/canvas").then(
        () => true,
        () => false,
      ),
    ]).then(([sharp, canvas]) => ({ sharp, canvas }));
  }
  return nativosPromise;
}

export function createServerlessApp() {
  const app = express();
  const limiters = buildRateLimiters();
  const jobStore = getJobStore();

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
  const health: express.RequestHandler = async (_req, res) => {
    res.status(configOk() ? 200 : 503).json({
      ok: configOk(),
      service: "medfluxo-motor-luan",
      runtime: "vercel-function",
      version: APP_VERSION,
      modelos: modelosEmUso(),
      modelosDesconhecidos: await modelosDesconhecidos(Object.values(modelosEmUso())),
      hasOpenAIKey: hasOpenAIKey(),
      aiMock: env.AI_MOCK,
      supabase: hasSupabase(),
      authRequired: authRequired(),
      nativos: await checarNativos(),
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

  // O upload não passa por aqui: o navegador envia direto ao Supabase Storage e
  // esta rota recebe só o caminho. `waitUntil` mantém a invocação viva depois
  // da resposta 202 — sem ele, o processamento seria interrompido e o job
  // ficaria preso em "processing".
  app.use(
    "/api/extract",
    createExtractRouter({
      jobStore,
      limiters,
      manterVivo: (promise) => waitUntil(promise),
    }),
  );

  // Passagem de plantão: job assíncrono, um lote por invocação. O teto de 60 s
  // do plano hobby não comporta 15 arquivos numa requisição só, e requisição
  // que estoura o teto deixa o médico sem nada no meio do plantão.
  app.use(
    "/api/passagem-plantao",
    limiters.passagem,
    createPassagemPlantaoRouter({
      jobStore,
      manterVivo: (promise) => waitUntil(promise),
    }),
  );

  app.use("/api", apiNotFound);
  app.use(errorHandler);
  return app;
}
