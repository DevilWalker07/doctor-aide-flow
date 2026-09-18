import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const here = path.dirname(fileURLToPath(import.meta.url));
for (const rel of [".env", "../.env", "../../.env"]) {
  dotenv.config({ path: path.join(here, rel), quiet: true });
}

const bool = z
  .union([z.boolean(), z.string()])
  .transform((v) =>
    typeof v === "boolean" ? v : ["1", "true", "yes", "on"].includes(v.toLowerCase()),
  );

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8787),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  /**
   * Modelos por finalidade. Ausentes, caem em `OPENAI_MODEL` — nada muda até
   * receberem valor, e nenhuma implantação existente quebra.
   *
   * A separação existe porque as chamadas não correm o mesmo risco. Ler um
   * número errado na foto do prontuário é o erro que nenhum guardrail pega: o
   * valor entra validado pelo Zod e errado na origem. Reformatar um texto já
   * extraído não tem esse problema.
   */
  OPENAI_MODEL_VISAO: z.string().optional(),
  OPENAI_MODEL_COPILOTO: z.string().optional(),
  OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().default(90_000),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  ALLOWED_ORIGINS: z.string().default(""),
  /**
   * Login obrigatório?
   *
   * Passou a ser opcional por decisão do dono do app: ele usa sozinho, em
   * plantão, e a tela de login só atrapalhava. `AUTH_OPTIONAL=false` volta a
   * exigir sessão.
   *
   * O que isso significa, para ficar registrado: sem login, quem tiver o
   * endereço usa o app, e os arquivos enviados ficam numa pasta comum em vez
   * de uma por médico.
   */
  AUTH_OPTIONAL: bool.default(true),
  AI_MOCK: bool.default(false),
  MAX_PDF_PAGES: z.coerce.number().int().min(1).max(30).default(15),
  STATIC_DIR: z.string().optional(),
  /** Orçamento de tempo da extração de documento. Ver `extractBudgetMs`. */
  EXTRACT_BUDGET_MS: z.coerce.number().int().positive().optional(),
  /** Definida pela própria plataforma quando roda na Vercel. */
  VERCEL: z.string().optional(),
});

const parsed = EnvSchema.safeParse(process.env);

/**
 * Motivos pelos quais a configuração está incompleta.
 *
 * Antes daqui saía um `process.exit(1)`. Em contêiner isso mata o serviço no
 * boot — foi assim que o backend ficou fora do ar sem ninguém perceber. Em
 * função serverless é pior ainda: derruba a invocação sem mensagem nenhuma.
 * Agora o erro fica legível e vira um 503 com motivo.
 */
export const configErrors: string[] = [];

if (!parsed.success) {
  const campos = Object.entries(parsed.error.flatten().fieldErrors)
    .map(([campo, erros]) => `${campo} (${erros?.join(", ")})`)
    .join(", ");
  configErrors.push(`Variáveis de ambiente inválidas: ${campos}`);
}

/**
 * Com o ambiente inválido caímos nos defaults do schema — `EnvSchema.parse({})`
 * sempre passa, porque todo campo é opcional ou tem default. Serve só para o
 * processo continuar de pé até responder 503; `configErrors` é a verdade.
 */
export const env = parsed.success ? parsed.data : EnvSchema.parse({});

export const isProduction = env.NODE_ENV === "production";
export const hasOpenAIKey = () => Boolean(env.OPENAI_API_KEY) || env.AI_MOCK;
export const hasSupabase = () => Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

export const authRequired = () => !env.AUTH_OPTIONAL;

if (authRequired() && !hasSupabase()) {
  configErrors.push(
    "Com AUTH_OPTIONAL=false é preciso SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para validar tokens.",
  );
}

if (configErrors.length > 0) {
  for (const motivo of configErrors) console.error(`[config] ${motivo}`);
}

/** Dá para atender requisição? Quando falso, a resposta é 503 com o motivo. */
export const configOk = () => configErrors.length === 0;

/**
 * Quanto tempo a extração de um documento pode levar antes de o job ser
 * marcado como erro.
 *
 * Em contêiner não há teto e o limite serve só para não deixar job preso. Em
 * função serverless a plataforma corta a invocação no `maxDuration`; se o corte
 * vier antes do nosso limite, o job fica em "processing" para sempre e a tela
 * de progresso gira sem fim. Por isso o orçamento fica **abaixo** do
 * `maxDuration` configurado no vercel.json (60 s), e quem estoura recebe uma
 * mensagem legível.
 */
/** Modelo para leitura de imagem: foto de prontuário e OCR de PDF escaneado. */
export const modeloVisao = () => env.OPENAI_MODEL_VISAO ?? env.OPENAI_MODEL;

/** Modelo do copiloto clínico: dose, diluição e conduta. */
export const modeloCopiloto = () => env.OPENAI_MODEL_COPILOTO ?? env.OPENAI_MODEL;

/** O que o /health mostra, para conferir que a variável pegou sem abrir painel. */
export const modelosEmUso = () => ({
  padrao: env.OPENAI_MODEL,
  visao: modeloVisao(),
  copiloto: modeloCopiloto(),
});

export const extractBudgetMs = () => env.EXTRACT_BUDGET_MS ?? (env.VERCEL ? 55_000 : 240_000);

export const allowedOrigins = () =>
  env.ALLOWED_ORIGINS.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const STATIC_DIR = env.STATIC_DIR ?? path.resolve(here, "../dist");
