import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Raiz do repositório — `agents/lib/` está dois níveis abaixo dela. */
export const REPO_ROOT = path.resolve(here, "..", "..");

/**
 * Diretórios que nunca entram na varredura de contexto nem podem ser escritos
 * pelo agente implementador. `.github/workflows` fica de fora por segurança:
 * um agente que reescreve o próprio CI que o valida é um jeito de contornar
 * validação, não uma melhoria.
 */
export const DIRETORIOS_IGNORADOS = new Set([
  "node_modules",
  ".git",
  "dist",
  "dist-server",
  "dist-ssr",
  "coverage",
  "playwright-report",
  "test-results",
  ".vinxi",
  ".output",
  ".nitro",
  "private-data",
  ".github",
]);

export const EXTENSOES_TEXTO = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".css",
  ".sql",
  ".yml",
  ".yaml",
  ".html",
]);
