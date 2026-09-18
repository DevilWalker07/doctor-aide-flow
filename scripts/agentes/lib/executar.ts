/**
 * Execução de comando e git, sem shell livre.
 *
 * Tudo por `execFileSync` com lista de argumentos: nunca uma string montada
 * que passa pelo shell. Assim nenhum nome de arquivo vindo do modelo pode
 * virar comando.
 */

import { execFileSync } from "node:child_process";
import { PORTAO, PROTEGIDOS_NO_DIFF, RAIZ, scriptPermitido } from "./limites.js";

export interface Resultado {
  ok: boolean;
  saida: string;
}

function rodar(arquivo: string, args: string[], timeoutMs = 600_000): Resultado {
  try {
    const saida = execFileSync(arquivo, args, {
      cwd: RAIZ,
      encoding: "utf-8",
      timeout: timeoutMs,
      maxBuffer: 20 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, saida };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return { ok: false, saida: [e.stdout, e.stderr, e.message].filter(Boolean).join("\n") };
  }
}

/** Só os scripts da lista fechada. O nome é conferido aqui, não no prompt. */
export function rodarScript(nome: string): Resultado {
  if (!scriptPermitido(nome)) {
    return { ok: false, saida: `Script não permitido: ${nome}` };
  }
  return rodar("npm", ["run", "--silent", nome]);
}

export function git(...args: string[]): Resultado {
  return rodar("git", args, 120_000);
}

export function branchAtual(): string {
  return git("rev-parse", "--abbrev-ref", "HEAD").saida.trim();
}

export function arquivosAlterados(): string[] {
  const a = git("status", "--porcelain");
  return a.saida
    .split("\n")
    .map((l) => l.slice(3).trim())
    .filter(Boolean);
}

/**
 * O portão.
 *
 * Roda typecheck, lint e test:unit de verdade, aqui, e devolve o que saiu. A
 * palavra do modelo sobre "os testes passam" não entra nesta decisão em
 * nenhum ponto.
 *
 * Antes de confiar no resultado, confere que o diff não encostou nos arquivos
 * que definem o próprio portão — um `typecheck` redefinido como `exit 0`
 * passaria alegremente.
 */
export function portao(): { ok: boolean; relatorio: string[] } {
  const relatorio: string[] = [];

  const tocados = arquivosAlterados().filter((f) =>
    PROTEGIDOS_NO_DIFF.some((p) => f === p || f.startsWith(`${p}/`)),
  );
  if (tocados.length > 0) {
    relatorio.push(
      `PORTÃO INVÁLIDO: o diff altera arquivo protegido (${tocados.join(", ")}). ` +
        "Esses arquivos definem o que typecheck, lint e test:unit fazem — " +
        "alterá-los invalidaria a checagem.",
    );
    return { ok: false, relatorio };
  }

  for (const script of PORTAO) {
    const r = rodarScript(script);
    relatorio.push(`${r.ok ? "PASSOU" : "FALHOU"}: npm run ${script}`);
    if (!r.ok) {
      relatorio.push(r.saida.split("\n").slice(-40).join("\n"));
      return { ok: false, relatorio };
    }
  }
  return { ok: true, relatorio };
}
