import fs from "node:fs";
import path from "node:path";
import { DIRETORIOS_IGNORADOS, REPO_ROOT } from "./paths.js";

const MAX_CHARS_LEITURA = 20_000;

/**
 * Confere que um caminho pedido pelo modelo continua dentro do repositório e
 * fora das áreas bloqueadas, antes de qualquer leitura/escrita.
 *
 * Existe porque o implementador roda com as mesmas permissões de arquivo do
 * processo que o invoca — sem isso, "corrija o bug" vira um caminho para ler
 * `.env` ou sobrescrever `.git/config`.
 */
export function resolverCaminhoSeguro(relativo: string): string {
  const alvo = path.resolve(REPO_ROOT, relativo);
  const relativoNormalizado = path.relative(REPO_ROOT, alvo);

  if (relativoNormalizado.startsWith("..") || path.isAbsolute(relativoNormalizado)) {
    throw new Error(`Caminho fora do repositório: ${relativo}`);
  }

  const primeiroSegmento = relativoNormalizado.split(path.sep)[0];
  if (DIRETORIOS_IGNORADOS.has(primeiroSegmento)) {
    throw new Error(`Caminho bloqueado por segurança: ${relativo}`);
  }

  const nomeArquivo = path.basename(relativoNormalizado);
  if (nomeArquivo === ".env" || nomeArquivo.startsWith(".env.")) {
    throw new Error(`Arquivos de ambiente não podem ser lidos ou alterados: ${relativo}`);
  }

  return alvo;
}

export function listarArquivos(diretorioRelativo: string): string[] {
  const alvo = resolverCaminhoSeguro(diretorioRelativo);
  if (!fs.existsSync(alvo)) return [];
  return fs
    .readdirSync(alvo, { withFileTypes: true })
    .filter((e) => !DIRETORIOS_IGNORADOS.has(e.name))
    .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
    .sort();
}

export function lerArquivo(caminhoRelativo: string): string {
  const alvo = resolverCaminhoSeguro(caminhoRelativo);
  if (!fs.existsSync(alvo) || !fs.statSync(alvo).isFile()) {
    throw new Error(`Arquivo não encontrado: ${caminhoRelativo}`);
  }
  const conteudo = fs.readFileSync(alvo, "utf8");
  return conteudo.length > MAX_CHARS_LEITURA
    ? `${conteudo.slice(0, MAX_CHARS_LEITURA)}\n… (truncado, ${conteudo.length} caracteres no total)`
    : conteudo;
}

export function escreverArquivo(caminhoRelativo: string, conteudo: string): void {
  const alvo = resolverCaminhoSeguro(caminhoRelativo);
  fs.mkdirSync(path.dirname(alvo), { recursive: true });
  fs.writeFileSync(alvo, conteudo, "utf8");
}
