/**
 * O que o agente vê do repositório.
 *
 * Mandar a árvore inteira estoura o contexto e não ajuda: o que importa é o
 * CLAUDE.md (as regras que não se negociam), as rotas de verdade, os schemas
 * Zod e a forma da árvore. Arquivo grande entra recortado, e o recorte é dito
 * no texto — modelo que não sabe que está vendo um pedaço opina sobre o que
 * não leu.
 */

import fs from "node:fs";
import path from "node:path";
import { RAIZ } from "./limites.js";

const IGNORAR = new Set([
  "node_modules",
  ".git",
  "dist",
  "dist-server",
  "private-data",
  "test-results",
  "playwright-report",
  "coverage",
  ".vercel",
]);

export function arvore(dir = RAIZ, prefixo = "", profundidade = 3): string[] {
  if (profundidade < 0) return [];
  const saida: string[] = [];
  let entradas: fs.Dirent[];
  try {
    entradas = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const e of entradas.sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name.startsWith(".") && e.name !== ".github") continue;
    if (IGNORAR.has(e.name)) continue;
    const rel = prefixo ? `${prefixo}/${e.name}` : e.name;
    if (e.isDirectory()) {
      saida.push(`${rel}/`);
      saida.push(...arvore(path.join(dir, e.name), rel, profundidade - 1));
    } else if (/\.(ts|tsx|sql|md|json|css)$/.test(e.name)) {
      saida.push(rel);
    }
  }
  return saida;
}

export function lerRecortado(relativo: string, maxChars: number): string | null {
  const abs = path.join(RAIZ, relativo);
  if (!fs.existsSync(abs)) return null;
  const texto = fs.readFileSync(abs, "utf-8");
  if (texto.length <= maxChars) return texto;
  return (
    texto.slice(0, maxChars) +
    `\n\n[...recortado: ${relativo} tem ${texto.length} caracteres, você está vendo os primeiros ${maxChars}]`
  );
}

/** As rotas de IA que existem de verdade, lidas do código e não do que se lembra. */
export function rotasDeIa(): string[] {
  const arquivo = path.join(RAIZ, "server/routes/ai.routes.ts");
  if (!fs.existsSync(arquivo)) return [];
  const texto = fs.readFileSync(arquivo, "utf-8");
  const achadas = new Set<string>();
  for (const m of texto.matchAll(/"(\/[a-z0-9-]+)"/g)) achadas.add(`/api/ai${m[1]}`);
  for (const m of texto.matchAll(/\[([^\]]*)\]/g)) {
    for (const s of m[1].matchAll(/"(\/[a-z0-9-:$]+)"/g)) achadas.add(`/api/ai${s[1]}`);
  }
  return [...achadas].sort();
}

export function commitAtual(): string {
  try {
    return fs
      .readFileSync(path.join(RAIZ, ".git/HEAD"), "utf-8")
      .trim()
      .replace(/^ref: /, "");
  } catch {
    return "desconhecido";
  }
}

export interface Contexto {
  claudeMd: string;
  arvore: string[];
  rotas: string[];
  schemas: string;
  ambientes: string;
  guardrails: string;
}

export function montarContexto(): Contexto {
  return {
    claudeMd: lerRecortado("CLAUDE.md", 12_000) ?? "(sem CLAUDE.md)",
    arvore: arvore(),
    rotas: rotasDeIa(),
    schemas: lerRecortado("server/schemas/ai.schemas.ts", 16_000) ?? "(sem schemas)",
    ambientes: lerRecortado("src/lib/ambientes.ts", 10_000) ?? "(sem ambientes.ts)",
    guardrails: lerRecortado("server/services/clinicalGuardrails.ts", 8_000) ?? "(sem guardrails)",
  };
}
