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
if (!parsed.success) {
  console.error("[config] Variáveis de ambiente inválidas:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === "production";
export const hasOpenAIKey = () => Boolean(env.OPENAI_API_KEY) || env.AI_MOCK;
export const hasSupabase = () => Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

// Autenticação é obrigatória por padrão. AUTH_OPTIONAL=true só para dev/testes sem Supabase.
export const authRequired = () => !env.AUTH_OPTIONAL;

if (authRequired() && !hasSupabase()) {
  console.error(
    "[config] Sem SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY o backend não valida tokens. Defina as variáveis ou AUTH_OPTIONAL=true (apenas dev).",
  );
  process.exit(1);
}
export const allowedOrigins = () =>
  env.ALLOWED_ORIGINS.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const STATIC_DIR = env.STATIC_DIR ?? path.resolve(here, "../dist");
