import { waitUntil } from "@vercel/functions";
import express from "express";
import helmet from "helmet";
import { authRequired, configErrors, configOk, env, hasOpenAIKey, modelosEmUso } from "./config.js";
import { requireAuth } from "./middleware/auth.js";
import { apiNotFound, errorHandler } from "./middleware/errorHandler.js";
import { buildCors, buildRateLimiters } from "./middleware/security.js";
import { aiRouter } from "./routes/ai.routes.js";
import { createExtractRouter } from "./routes/extract.routes.js";
import { sondarSupabase } from "./lib/supabaseAdmin.js";
import { getJobStore } from "./services/jobStore.js";
import { modelosDesconhecidos } from "./services/openaiClient.js";
import { APP_VERSION } from "./app.js";

/**
 * A mesma aplicação, sem o que não cabe em função serverless.
 *
 * Só a casca muda: `aiRouter`, os prompts, os schemas Zod e os guardrails
 * clínicos são exatamente os mesmos de `createApp`. O que fica de fora é o
 * upload multipart (aqui o navegador envia direto ao Storage) e o servir de
 * arquivo estático, que na Vercel é o próprio CDN. A passagem de plantão não
 * tem rota própria: são três chamadas curtas em `/api/ai`.
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

  /**
   * Normaliza o caminho para a forma que as rotas esperam: `/api/...`.
   *
   * Toda a API vive sob `/api` aqui, e quem decide o que a função recebe é o
   * rewrite da Vercel — detalhe de plataforma que eu não consigo exercitar em
   * teste nenhum daqui. Foi exatamente esse ponto cego que deixou a API inteira
   * respondendo 404 em produção enquanto 231 testes e 26 specs passavam: eles
   * rodam contra o contêiner, onde o Express faz o roteamento todo.
   *
   * Com esta normalização, a aplicação funciona recebendo `/api/ai/copiloto` ou
   * `/ai/copiloto`. Não é remendo: é parar de depender de um comportamento que
   * não está sob o nosso controle nem sob os nossos testes.
   */
  app.use((req, _res, next) => {
    if (req.url === "/health" || req.url.startsWith("/health?")) return next();
    if (!req.url.startsWith("/api/") && req.url !== "/api") {
      req.url = `/api${req.url === "/" ? "" : req.url}`;
    }
    next();
  });

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
      // Estado sondado, não `hasSupabase()`: aquilo só dizia que as variáveis
      // existem, e respondia `true` com a chave revogada e com a tabela dos
      // jobs ausente — que foi o defeito que ficou meses invisível aqui.
      supabase: await sondarSupabase(),
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

  app.use("/api", apiNotFound);
  app.use(errorHandler);
  return app;
}
