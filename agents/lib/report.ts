import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./paths.js";
import { type Registro, RegistroSchema } from "../schemas.js";

const DIR_RELATORIOS = path.join(REPO_ROOT, "docs/agentes/relatorios");
const DIR_HISTORICO = path.join(DIR_RELATORIOS, "historico");
const ARQUIVO_LATEST_JSON = path.join(DIR_RELATORIOS, "latest.json");
const ARQUIVO_LATEST_MD = path.join(DIR_RELATORIOS, "latest.md");

export function lerRegistro(): Registro | null {
  if (!fs.existsSync(ARQUIVO_LATEST_JSON)) return null;
  const bruto = JSON.parse(fs.readFileSync(ARQUIVO_LATEST_JSON, "utf8"));
  const validado = RegistroSchema.safeParse(bruto);
  if (!validado.success) {
    throw new Error(
      `docs/agentes/relatorios/latest.json não bate com o schema esperado: ${validado.error.message}`,
    );
  }
  return validado.data;
}

const EMOJI_STATUS: Record<string, string> = {
  pendente: "⬜",
  em_andamento: "🟡",
  implementado: "✅",
  falhou: "❌",
};

const EMOJI_PRIORIDADE: Record<string, string> = { alta: "🔴", media: "🟠", baixa: "🟢" };

function renderMarkdown(registro: Registro): string {
  const linhas = [
    "# Relatório do agente analista",
    "",
    `_Gerado em ${registro.gerado_em}_`,
    "",
    registro.resumo,
    "",
    "| | Prioridade | Item | Categoria | Esforço | Status |",
    "|---|---|---|---|---|---|",
  ];

  for (const item of registro.itens) {
    linhas.push(
      `| \`${item.id}\` | ${EMOJI_PRIORIDADE[item.prioridade]} ${item.prioridade} | **${item.titulo}** | ${item.categoria} | ${item.esforco} | ${EMOJI_STATUS[item.status]} ${item.status} |`,
    );
  }

  linhas.push("", "## Detalhes", "");
  for (const item of registro.itens) {
    linhas.push(
      `### \`${item.id}\` — ${item.titulo}`,
      "",
      `**Problema:** ${item.problema}`,
      "",
      `**Sugestão:** ${item.sugestao}`,
      "",
    );
    if (item.arquivos_relacionados.length > 0) {
      linhas.push(
        `**Arquivos relacionados:** ${item.arquivos_relacionados.map((a) => `\`${a}\``).join(", ")}`,
        "",
      );
    }
    if (item.status !== "pendente") {
      linhas.push(
        `**Status:** ${item.status}${item.branch ? ` — branch \`${item.branch}\`` : ""}${item.pr_url ? ` — [PR](${item.pr_url})` : ""}`,
        "",
      );
    }
    if (item.erro) {
      linhas.push("**Erro na última tentativa:**", "```", item.erro.slice(0, 4000), "```", "");
    }
  }

  linhas.push(
    "---",
    "",
    "Rode `npm run agente:implementar -- --id <id>` para implementar um item pendente.",
  );
  return linhas.join("\n");
}

export function salvarRegistro(registro: Registro): void {
  fs.mkdirSync(DIR_HISTORICO, { recursive: true });
  const json = JSON.stringify(registro, null, 2);
  fs.writeFileSync(ARQUIVO_LATEST_JSON, json, "utf8");
  fs.writeFileSync(ARQUIVO_LATEST_MD, renderMarkdown(registro), "utf8");
  const carimbo = registro.gerado_em.replace(/[:.]/g, "-");
  fs.writeFileSync(path.join(DIR_HISTORICO, `${carimbo}.json`), json, "utf8");
}
