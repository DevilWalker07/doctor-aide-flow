import fs from "node:fs";
import path from "node:path";
import { DIRETORIOS_IGNORADOS, REPO_ROOT } from "./paths.js";

const MAX_ARQUIVOS_NA_ARVORE = 1500;
const MAX_CHARS_POR_ARQUIVO = 6000;

function lerSeExistir(caminhoRelativo: string, limite = MAX_CHARS_POR_ARQUIVO): string | null {
  const alvo = path.join(REPO_ROOT, caminhoRelativo);
  if (!fs.existsSync(alvo)) return null;
  const conteudo = fs.readFileSync(alvo, "utf8");
  return conteudo.length > limite
    ? `${conteudo.slice(0, limite)}\n… (truncado, ${conteudo.length} caracteres no total)`
    : conteudo;
}

/** Árvore de arquivos do repositório, só caminhos, ignorando o que não importa para a análise. */
function arvoreDeArquivos(): string[] {
  const resultado: string[] = [];

  function caminhar(dir: string) {
    if (resultado.length >= MAX_ARQUIVOS_NA_ARVORE) return;
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      if (resultado.length >= MAX_ARQUIVOS_NA_ARVORE) return;
      if (DIRETORIOS_IGNORADOS.has(entrada.name)) continue;
      const caminhoAbsoluto = path.join(dir, entrada.name);
      if (entrada.isDirectory()) {
        caminhar(caminhoAbsoluto);
      } else {
        resultado.push(path.relative(REPO_ROOT, caminhoAbsoluto));
      }
    }
  }

  caminhar(REPO_ROOT);
  return resultado.sort();
}

/**
 * Resumo de um diretório de rotas/serviços: para cada arquivo, só as linhas
 * de `export` — dá para o modelo enxergar a superfície sem gastar tokens com
 * a implementação inteira.
 */
export function resumoDeExports(diretorioRelativo: string): string {
  const dir = path.join(REPO_ROOT, diretorioRelativo);
  if (!fs.existsSync(dir)) return "(diretório não encontrado)";

  const linhas: string[] = [];
  for (const arquivo of fs.readdirSync(dir).sort()) {
    if (!arquivo.endsWith(".ts") && !arquivo.endsWith(".tsx")) continue;
    const conteudo = fs.readFileSync(path.join(dir, arquivo), "utf8");
    const exports = conteudo
      .split("\n")
      .filter((l) => /^export\s/.test(l.trim()))
      .map((l) => l.trim());
    linhas.push(`### ${diretorioRelativo}/${arquivo}`, ...exports, "");
  }
  return linhas.join("\n") || "(sem arquivos .ts)";
}

export interface ContextoRepositorio {
  claudeMd: string;
  packageJson: string;
  ambientes: string;
  rotasServidor: string;
  rotasFrontend: string;
  schemasIA: string;
  arvore: string[];
}

/** Monta o contexto que o agente analista recebe — compacto de propósito. */
export function montarContextoRepositorio(): ContextoRepositorio {
  return {
    claudeMd: lerSeExistir("CLAUDE.md", 20_000) ?? "(CLAUDE.md ausente)",
    packageJson: lerSeExistir("package.json") ?? "(package.json ausente)",
    ambientes: lerSeExistir("src/lib/ambientes.ts") ?? "(src/lib/ambientes.ts ausente)",
    rotasServidor: resumoDeExports("server/routes"),
    rotasFrontend: fs.existsSync(path.join(REPO_ROOT, "src/routes"))
      ? arvoreDeArquivos()
          .filter((p) => p.startsWith("src/routes/"))
          .join("\n")
      : "(src/routes ausente)",
    schemasIA: resumoDeExports("server/schemas"),
    arvore: arvoreDeArquivos(),
  };
}

export function contextoComoTexto(ctx: ContextoRepositorio): string {
  return [
    "## CLAUDE.md (regras do projeto)",
    ctx.claudeMd,
    "\n## package.json",
    ctx.packageJson,
    "\n## src/lib/ambientes.ts (fonte única dos ambientes/fluxos clínicos)",
    ctx.ambientes,
    "\n## Exports de server/routes",
    ctx.rotasServidor,
    "\n## Exports de server/schemas",
    ctx.schemasIA,
    "\n## Rotas do frontend (src/routes)",
    ctx.rotasFrontend,
    "\n## Árvore de arquivos do repositório",
    ctx.arvore.join("\n"),
  ].join("\n");
}
