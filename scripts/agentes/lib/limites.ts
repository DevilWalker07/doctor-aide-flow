/**
 * Limites do agente de manutenção. **No código, nunca no prompt.**
 *
 * Um limite escrito no prompt é um pedido; o modelo pode ignorá-lo, ser
 * convencido a ignorá-lo, ou simplesmente errar. Estas funções são o que
 * realmente impede a escrita — o prompt apenas informa o modelo de que elas
 * existem, para ele não perder tempo tentando.
 */

import fs from "node:fs";
import path from "node:path";

export const RAIZ = path.resolve(import.meta.dirname, "../../..");

/**
 * Caminhos que o agente nunca toca.
 *
 * Os quatro primeiros são o que você pediu. Os demais fecham um buraco do
 * desenho: a lista fechada de scripts é por NOME, e o que cada nome executa
 * mora no package.json. Com permissão de escrever ali, o agente poderia
 * redefinir `typecheck` como `exit 0` e o portão "passaria de verdade" sem
 * checar nada. Mesma coisa para os tsconfig, o eslint e o vitest: dá para
 * afrouxar a regra em vez de corrigir o código.
 */
const BLOQUEADOS = [
  ".git",
  "node_modules",
  "private-data",
  ".github",
  // O portão não pode ser editável por quem ele contém.
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "tsconfig.server.json",
  "tsconfig.test.json",
  "eslint.config.js",
  "vitest.config.ts",
  ".prettierrc",
  ".prettierignore",
  // O próprio agente também não se reescreve.
  "scripts/agentes",
];

/**
 * Arquivos cuja alteração invalida o portão, conferidos no diff antes de
 * confiar nele.
 *
 * A lista é explícita em vez de derivada de BLOQUEADOS por filtro: a primeira
 * versão usava `!p.startsWith(".git")`, e isso também excluía `.github`, que
 * deveria estar aqui. Esperteza em regra de segurança acaba assim.
 */
const NAO_APARECEM_EM_DIFF = new Set([".git", "node_modules", "private-data"]);
export const PROTEGIDOS_NO_DIFF = BLOQUEADOS.filter((p) => !NAO_APARECEM_EM_DIFF.has(p));

function ehEnv(relativo: string): boolean {
  const base = path.basename(relativo);
  // .env, .env.local, server/.env — mas .env.example é versionado e inofensivo.
  return base.startsWith(".env") && base !== ".env.example";
}

export class LimiteViolado extends Error {
  constructor(caminho: string, motivo: string) {
    super(`Bloqueado: ${caminho} — ${motivo}`);
    this.name = "LimiteViolado";
  }
}

/**
 * Resolve o caminho e recusa qualquer coisa fora dos limites.
 *
 * A checagem é feita no caminho **resolvido**, não no que o modelo escreveu:
 * `src/../../etc/passwd` e `src/./../.env` só aparecem depois de resolver. E
 * `realpath` do diretório pai fecha a fuga por link simbólico.
 */
export function caminhoSeguro(relativoPedido: string): string {
  if (typeof relativoPedido !== "string" || relativoPedido.trim() === "") {
    throw new LimiteViolado(String(relativoPedido), "caminho vazio");
  }
  if (path.isAbsolute(relativoPedido)) {
    throw new LimiteViolado(relativoPedido, "use caminho relativo à raiz do repositório");
  }

  const absoluto = path.resolve(RAIZ, relativoPedido);
  const relativo = path.relative(RAIZ, absoluto);

  if (relativo === "" || relativo.startsWith("..")) {
    throw new LimiteViolado(relativoPedido, "fora do repositório");
  }
  if (ehEnv(relativo)) {
    throw new LimiteViolado(relativo, "arquivo de ambiente guarda segredo");
  }

  const partes = relativo.split(path.sep);
  for (const bloqueado of BLOQUEADOS) {
    const alvo = bloqueado.split("/");
    if (alvo.every((seg, i) => partes[i] === seg)) {
      throw new LimiteViolado(relativo, `${bloqueado} é protegido`);
    }
  }

  // Link simbólico apontando para fora: confere o pai que existe.
  let pai = path.dirname(absoluto);
  while (pai !== RAIZ && pai.startsWith(RAIZ)) {
    if (fs.existsSync(pai)) {
      const real = fs.realpathSync(pai);
      if (!real.startsWith(fs.realpathSync(RAIZ))) {
        throw new LimiteViolado(relativo, "caminho sai do repositório por link simbólico");
      }
      break;
    }
    pai = path.dirname(pai);
  }

  return absoluto;
}

/** Scripts que o agente pode executar. Nenhum outro, e nada de shell livre. */
export const SCRIPTS_PERMITIDOS = ["typecheck", "lint", "test:unit", "format"] as const;
export type ScriptPermitido = (typeof SCRIPTS_PERMITIDOS)[number];

/** O portão: sem estes três passando, nada é commitado. */
export const PORTAO: ScriptPermitido[] = ["typecheck", "lint", "test:unit"];

export function scriptPermitido(nome: string): nome is ScriptPermitido {
  return (SCRIPTS_PERMITIDOS as readonly string[]).includes(nome);
}

/** Tamanho máximo de arquivo que o agente escreve, para não despejar lixo. */
export const LIMITE_ESCRITA_BYTES = 200_000;
