import { execFileSync } from "node:child_process";
import { REPO_ROOT } from "./paths.js";

/**
 * Sempre `execFileSync` com array de argumentos — nunca template string
 * interpolando mensagem de commit ou nome de branch num shell. A mensagem de
 * commit vem do próprio modelo; tratá-la como string de shell seria injeção
 * de comando por prompt.
 */
function git(args: string[]): string {
  return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" });
}

export function branchAtual(): string {
  return git(["rev-parse", "--abbrev-ref", "HEAD"]).trim();
}

export function arvoreSuja(): boolean {
  return git(["status", "--porcelain"]).trim().length > 0;
}

export function criarBranch(nome: string): void {
  git(["checkout", "-b", nome]);
}

export function voltarPara(branch: string): void {
  git(["checkout", branch]);
}

export function commitTudo(mensagem: string): string {
  git(["add", "-A"]);
  git(["commit", "-m", mensagem]);
  return git(["rev-parse", "HEAD"]).trim();
}

export function push(branch: string): void {
  git(["push", "-u", "origin", branch]);
}

export interface ResultadoVerificacao {
  ok: boolean;
  saida: string;
}

const SCRIPTS_PERMITIDOS = ["typecheck", "lint", "test:unit", "format"] as const;
export type ScriptPermitido = (typeof SCRIPTS_PERMITIDOS)[number];

/**
 * Roda um script do `package.json` da lista fechada acima — nunca um comando
 * arbitrário vindo do modelo. `npm run <script>` é a única forma de execução
 * de processo que o agente implementador tem.
 */
export function rodarVerificacao(script: ScriptPermitido): ResultadoVerificacao {
  if (!SCRIPTS_PERMITIDOS.includes(script)) {
    return { ok: false, saida: `Script não permitido: ${script}` };
  }
  try {
    const saida = execFileSync("npm", ["run", script], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    });
    return { ok: true, saida };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, saida: `${e.stdout ?? ""}\n${e.stderr ?? e.message ?? ""}`.trim() };
  }
}

/**
 * Abre um PR via API REST do GitHub, se `GITHUB_TOKEN` e `GITHUB_REPOSITORY`
 * estiverem no ambiente (ex.: rodando dentro de uma GitHub Action). Sem eles,
 * o branch já empurrado basta — abrir o PR manualmente é trivial.
 */
export async function abrirPullRequestSePossivel(opts: {
  branch: string;
  base: string;
  titulo: string;
  corpo: string;
}): Promise<string | null> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) return null;

  const resposta = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: opts.titulo,
      head: opts.branch,
      base: opts.base,
      body: opts.corpo,
    }),
  });

  if (!resposta.ok) {
    console.warn(`[agentes] não deu para abrir PR automaticamente (${resposta.status}).`);
    return null;
  }
  const dados = (await resposta.json()) as { html_url: string };
  return dados.html_url;
}
