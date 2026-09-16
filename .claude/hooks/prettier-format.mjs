#!/usr/bin/env node
// PostToolUse hook (Edit|Write): formata o arquivo alterado com o Prettier do
// próprio projeto antes que o usuário o veja. Qualquer coisa que não seja um
// arquivo de código/texto suportado pelo Prettier (binários, .env, lockfiles,
// arquivos ignorados via .prettierignore, etc.) é ignorada em silêncio.
// Nunca lança erro nem produz saída: falhas aqui não podem travar o fluxo.

import fs from "node:fs";
import path from "node:path";

async function main() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }

  const filePath = payload?.tool_input?.file_path;
  if (!filePath || typeof filePath !== "string") return;
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return;

  const projectDir = process.env.CLAUDE_PROJECT_DIR || payload?.cwd || process.cwd();

  let prettier;
  try {
    prettier = await import("prettier");
  } catch {
    return; // Prettier não instalado (ex.: node_modules ausente) — sai em silêncio.
  }

  try {
    const fileInfo = await prettier.getFileInfo(filePath, {
      ignorePath: [path.join(projectDir, ".prettierignore")],
      resolveConfig: true,
    });

    // Sem parser inferido (não é um tipo de arquivo suportado) ou arquivo
    // coberto pelo .prettierignore: não faz nada.
    if (!fileInfo.inferredParser || fileInfo.ignored) return;

    const source = fs.readFileSync(filePath, "utf8");
    const config = (await prettier.resolveConfig(filePath)) || {};
    const formatted = await prettier.format(source, {
      ...config,
      filepath: filePath,
    });

    if (formatted !== source) {
      fs.writeFileSync(filePath, formatted, "utf8");
    }
  } catch {
    // Erro de parsing/formatação: não bloqueia o fluxo, apenas não formata.
  }
}

main().catch(() => {});
