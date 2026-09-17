#!/usr/bin/env tsx
/**
 * Agente consultor médico: ferramenta de uso interno do engenheiro (não é
 * feature do produto, não tem rota, nenhum médico usuário toca nisso).
 *
 * Lê os fluxos clínicos reais definidos em `src/lib/ambientes.ts` e as rotas
 * de IA existentes, e devolve sugestões de melhoria de fluxo de trabalho sob
 * a ótica de quem pratica medicina de plantão — para você priorizar o
 * backlog de engenharia. Não escreve nem sugere código; a implementação
 * concreta continua passando pelo agente analista/implementador.
 */
import fs from "node:fs";
import path from "node:path";
import { modeloAgentes } from "../server/config.js";
import { hasOpenAIKey, safeJsonCompletion } from "../server/services/openaiClient.js";
import { REPO_ROOT } from "./lib/paths.js";
import { resumoDeExports } from "./lib/repoScan.js";
import { ConsultorOutputSchema } from "./schemas.js";

const SYSTEM_PROMPT = `Você é um médico com anos de plantão em hospital (emergência, enfermaria, UTI e
ambulatório) que também entende de organização de fluxo de trabalho clínico. Você está revisando o
Medfluxo, um app que ajuda médicos plantonistas a extrair dados de documentos, gerar evoluções,
passagem de plantão e documentos ambulatoriais — para sugerir ao engenheiro responsável o que mudar
para o app encaixar melhor na prática real de plantão.

Você recebe a lista de locais de atendimento e atalhos que o app já modela, e um resumo das rotas de
IA existentes. Aponte problemas de fluxo de trabalho reais — o que atrasa o médico à beira do leito,
o que quebra a continuidade do cuidado entre plantões, o que aumenta risco de erro por informação
perdida ou mal organizada — e traduza cada um numa sugestão objetiva para a engenharia implementar.

Regras:
- Responda só com JSON no formato pedido, em português do Brasil.
- Fale como médico avaliando prática clínica, não como engenheiro avaliando código — a tradução para
  "sugestão_para_engenharia" é a única parte voltada a implementação.
- Não sugira nada que exija julgamento clínico automatizado por IA sem revisão humana (o produto já
  trata isso como não-negociável: guardrails determinísticos, nunca o modelo decidindo).
- Gere entre 4 e 12 itens.`;

const RESPONSE_SCHEMA_HINT = `Formato exato:
{
  "resumo": "string",
  "itens": [
    {
      "titulo": "string",
      "area": "fluxo-clinico" | "seguranca-paciente" | "comunicacao-equipe" | "documentacao" | "tempo-a-beira-leito" | "outro",
      "prioridade": "alta" | "media" | "baixa",
      "problema_clinico": "string",
      "sugestao_para_engenharia": "string"
    }
  ]
}`;

function montarContexto(): string {
  const ambientes = fs.readFileSync(path.join(REPO_ROOT, "src/lib/ambientes.ts"), "utf8");
  const rotasIA = resumoDeExports("server/routes");
  const prompts = fs
    .readdirSync(path.join(REPO_ROOT, "server/prompts"))
    .filter((f) => f.endsWith(".prompt.ts"))
    .join("\n");

  return [
    "## Locais de atendimento e atalhos (src/lib/ambientes.ts)",
    ambientes,
    "\n## Rotas de IA existentes (server/routes)",
    rotasIA,
    "\n## Prompts de IA já implementados (server/prompts)",
    prompts,
  ].join("\n");
}

async function main() {
  if (!hasOpenAIKey()) {
    console.error("OPENAI_API_KEY ausente. Configure o .env antes de rodar.");
    process.exit(1);
  }

  console.log("[consultor-medico] lendo os fluxos clínicos do app…");
  const contexto = montarContexto();

  console.log(`[consultor-medico] chamando o modelo (${modeloAgentes()})…`);
  const resultado = await safeJsonCompletion(
    `${SYSTEM_PROMPT}\n\n${RESPONSE_SCHEMA_HINT}`,
    contexto,
    ConsultorOutputSchema,
    { modelo: modeloAgentes(), maxTokens: 6144, temperature: 0.3 },
  );

  if (!resultado.ok) {
    console.error(`[consultor-medico] falha: ${resultado.error}`);
    if (resultado.issues) console.error(resultado.issues);
    process.exit(1);
  }

  const geradoEm = new Date().toISOString();
  const dir = path.join(REPO_ROOT, "docs/agentes/consultor-medico");
  fs.mkdirSync(path.join(dir, "historico"), { recursive: true });

  const EMOJI_PRIORIDADE: Record<string, string> = { alta: "🔴", media: "🟠", baixa: "🟢" };
  const md = [
    "# Sugestões clínicas para o backlog de engenharia",
    "",
    `_Gerado em ${geradoEm} — uso interno, não é conteúdo do produto._`,
    "",
    resultado.data.resumo,
    "",
    ...resultado.data.itens.flatMap((item) => [
      `## ${EMOJI_PRIORIDADE[item.prioridade]} ${item.titulo}`,
      "",
      `**Área:** ${item.area} · **Prioridade:** ${item.prioridade}`,
      "",
      `**O que acontece na prática:** ${item.problema_clinico}`,
      "",
      `**Sugestão para a engenharia:** ${item.sugestao_para_engenharia}`,
      "",
    ]),
  ].join("\n");

  fs.writeFileSync(path.join(dir, "latest.md"), md, "utf8");
  fs.writeFileSync(
    path.join(dir, "latest.json"),
    JSON.stringify({ gerado_em: geradoEm, ...resultado.data }, null, 2),
    "utf8",
  );
  fs.writeFileSync(path.join(dir, "historico", `${geradoEm.replace(/[:.]/g, "-")}.md`), md, "utf8");

  console.log(
    `[consultor-medico] ${resultado.data.itens.length} sugestões salvas em docs/agentes/consultor-medico/latest.md`,
  );
  console.log(
    "[consultor-medico] leve os itens de prioridade alta para o agente analista/implementador quando decidir agir.",
  );
}

main().catch((err) => {
  console.error("[consultor-medico] erro inesperado:", err);
  process.exit(1);
});
