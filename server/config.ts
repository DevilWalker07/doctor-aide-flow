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
  OPENAI_TIMEOUT_MS: z.coerce.number().int().positive().default(90_000),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  ALLOWED_ORIGINS: z.string().default(""),
  AUTH_OPTIONAL: bool.default(false),
  AI_MOCK: bool.default(false),
  MAX_PDF_PAGES: z.coerce.number().int().min(1).max(30).default(15),
  STATIC_DIR: z.string().optional(),
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

// Autenticação é obrigatória por padrão. AUTH_OPTIONAL=true só para dev/testes sem Supabase.
export const authRequired = () => !env.AUTH_OPTIONAL;

if (authRequired() && !hasSupabase()) {
  configErrors.push(
    "Sem SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY o backend não valida tokens. Defina as variáveis ou AUTH_OPTIONAL=true (apenas dev).",
  );
}

if (configErrors.length > 0) {
  for (const motivo of configErrors) console.error(`[config] ${motivo}`);
}

/** Dá para atender requisição? Quando falso, a resposta é 503 com o motivo. */
export const configOk = () => configErrors.length === 0;

export const allowedOrigins = () =>
  env.ALLOWED_ORIGINS.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const STATIC_DIR = env.STATIC_DIR ?? path.resolve(here, "../dist");
