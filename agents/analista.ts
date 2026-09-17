#!/usr/bin/env tsx
/**
 * Agente analista: lê o produto (código + CLAUDE.md) e devolve uma lista
 * priorizada do que falta ou pode melhorar.
 *
 * Roda por fora do app servido — não é uma rota HTTP. A função serverless da
 * Vercel não tem filesystem persistente nem git; isso aqui precisa das duas
 * coisas, então vive como CLI (`npm run agente:analisar`), rodado por um
 * humano ou por um workflow de CI com checkout do repositório.
 */
import { modeloAgentes } from "../server/config.js";
import { hasOpenAIKey, safeJsonCompletion } from "../server/services/openaiClient.js";
import { contextoComoTexto, montarContextoRepositorio } from "./lib/repoScan.js";
import { lerRegistro, salvarRegistro } from "./lib/report.js";
import { AnaliseOutputSchema } from "./schemas.js";

const SYSTEM_PROMPT = `Você é um engenheiro de software sênior fazendo auditoria de um SaaS
em produção: o Medfluxo, um assistente clínico para médicos de plantão hospitalar
(extrai dados de documentos, gera evoluções, passagem de plantão e documentos
ambulatoriais). Você recebe um recorte do repositório (regras do projeto,
package.json, rotas, schemas e a árvore de arquivos) e deve apontar o que falta
ou pode melhorar, com foco em produto, segurança, confiabilidade, performance,
UX e experiência de desenvolvimento.

Regras:
- Responda só com JSON no formato pedido, em português do Brasil.
- Seja concreto: cite arquivos/rotas reais do contexto quando fizer sentido,
  nunca invente caminhos que não apareceram no contexto.
- Priorize o que dá diferença real para um médico usando o app de pé, com
  pressa, muitas vezes à noite — não sugira reescritas cosméticas.
- Respeite as regras do CLAUDE.md (guardrails determinísticos, schema em toda
  saída de IA, RLS em toda tabela, etc.) como restrições, não como itens a
  "revisar".
- Gere entre 5 e 15 itens, cada um pequeno o suficiente para um único PR.
- O campo "id" é um slug curto e único (ex.: "rate-limit-copiloto").`;

const RESPONSE_SCHEMA_HINT = `Formato exato:
{
  "resumo": "string",
  "itens": [
    {
      "id": "slug-curto",
      "titulo": "string",
      "categoria": "produto" | "seguranca" | "confiabilidade" | "performance" | "ux" | "dx" | "dados",
      "prioridade": "alta" | "media" | "baixa",
      "esforco": "pequeno" | "medio" | "grande",
      "problema": "string",
      "sugestao": "string",
      "arquivos_relacionados": ["string"]
    }
  ]
}`;

async function main() {
  if (!hasOpenAIKey()) {
    console.error(
      "OPENAI_API_KEY ausente (ou AI_MOCK=1 sem fixture). Configure o .env antes de rodar.",
    );
    process.exit(1);
  }

  console.log("[analista] varrendo o repositório…");
  const contexto = contextoComoTexto(montarContextoRepositorio());

  console.log(`[analista] chamando o modelo (${modeloAgentes()})…`);
  const resultado = await safeJsonCompletion(
    `${SYSTEM_PROMPT}\n\n${RESPONSE_SCHEMA_HINT}`,
    contexto,
    AnaliseOutputSchema,
    { modelo: modeloAgentes(), maxTokens: 8192 },
  );

  if (!resultado.ok) {
    console.error(`[analista] falha: ${resultado.error}`);
    if (resultado.issues) console.error(resultado.issues);
    process.exit(1);
  }

  const anterior = lerRegistro();
  const statusAnterior = new Map(anterior?.itens.map((i) => [i.id, i]) ?? []);

  const geradoEm = new Date().toISOString();
  const registro = {
    resumo: resultado.data.resumo,
    gerado_em: geradoEm,
    itens: resultado.data.itens.map((item) => {
      const existente = statusAnterior.get(item.id);
      return {
        ...item,
        status: existente?.status ?? ("pendente" as const),
        branch: existente?.branch ?? null,
        commit: existente?.commit ?? null,
        pr_url: existente?.pr_url ?? null,
        erro: existente?.erro ?? null,
        atualizado_em: existente?.atualizado_em ?? geradoEm,
      };
    }),
  };

  salvarRegistro(registro);
  console.log(
    `[analista] ${registro.itens.length} itens salvos em docs/agentes/relatorios/latest.md`,
  );
  for (const item of registro.itens) {
    console.log(`  [${item.prioridade}] ${item.id} — ${item.titulo} (${item.status})`);
  }
}

main().catch((err) => {
  console.error("[analista] erro inesperado:", err);
  process.exit(1);
});
