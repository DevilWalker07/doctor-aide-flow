/**
 * npm run agente:analisar
 *
 * Varre CLAUDE.md, as rotas de IA reais, os schemas Zod e a árvore do
 * repositório, e grava melhorias priorizadas em
 * docs/agentes/relatorios/latest.{md,json}.
 *
 * Só lê. Não escreve nada fora de docs/agentes/relatorios.
 */

import fs from "node:fs";
import path from "node:path";
import { commitAtual, montarContexto } from "./lib/contexto.js";
import { cliente, json, modelo } from "./lib/ia.js";
import { RAIZ } from "./lib/limites.js";
import {
  CATEGORIAS,
  RelatorioSchema,
  ordenar,
  paraMarkdown,
  type RelatorioGravado,
} from "./lib/relatorio.js";

const SYSTEM = `Você audita o Medfluxo, um assistente clínico para médicos de plantão hospitalar
no Brasil. O usuário é médico, trabalha sozinho no código e usa o app em plantão real.

Seu trabalho é apontar melhorias concretas, não elogiar o que existe.

Categorias: ${CATEGORIAS.join(", ")}.

O que é um bom item:
- Aponta um problema que dá para verificar no código que você recebeu.
- Cita arquivo e, quando possível, o trecho responsável.
- Tem critério de aceite verificável, não "melhorar a experiência".
- Cabe numa mudança. "Refatorar o app" não é item.

O que NÃO fazer:
- Não invente arquivo, rota ou função que não esteja no material.
- Não sugira o que o CLAUDE.md proíbe explicitamente — ele é a regra da casa,
  e contrariá-lo é erro, não ousadia.
- Não proponha mexer em limiar clínico, dose, guardrail ou dado de paciente
  sem marcar exige_revisao_humana: true. Isso não é delegável a um agente.
- Não repita item que já está resolvido no código que você leu.

Marque exige_revisao_humana: true sempre que a mudança encostar em decisão
clínica, conteúdo de prompt médico, ou dado de paciente.

Responda APENAS JSON:
{ "resumo": "...", "itens": [ { "id": "kebab-case", "titulo": "...", "categoria": "...",
  "prioridade": 1, "problema": "...", "proposta": "...", "arquivos": ["..."],
  "criterio_de_aceite": ["..."], "esforco": "pequeno", "exige_revisao_humana": false } ] }`;

async function main(): Promise<void> {
  const ctx = montarContexto();
  const openai = cliente();

  const user = [
    "## CLAUDE.md (as regras que não se negociam)",
    ctx.claudeMd,
    "",
    "## Rotas de IA que existem de verdade",
    ctx.rotas.join("\n") || "(nenhuma encontrada)",
    "",
    "## server/schemas/ai.schemas.ts",
    ctx.schemas,
    "",
    "## src/lib/ambientes.ts (fonte única dos locais de atendimento)",
    ctx.ambientes,
    "",
    "## server/services/clinicalGuardrails.ts",
    ctx.guardrails,
    "",
    "## Árvore do repositório",
    ctx.arvore.join("\n"),
  ].join("\n");

  console.log(`Analisando ${ctx.arvore.length} arquivos com ${modelo()}…`);

  const relatorio = await json(openai, SYSTEM, user, (v) => RelatorioSchema.parse(v));

  const gravado: RelatorioGravado = {
    ...relatorio,
    itens: ordenar(relatorio.itens),
    gerado_em: new Date().toISOString(),
    commit: commitAtual(),
    modelo: modelo(),
  };

  const destino = path.join(RAIZ, "docs/agentes/relatorios");
  fs.mkdirSync(destino, { recursive: true });
  fs.writeFileSync(path.join(destino, "latest.json"), JSON.stringify(gravado, null, 2) + "\n");
  fs.writeFileSync(path.join(destino, "latest.md"), paraMarkdown(gravado));

  const humanos = gravado.itens.filter((i) => i.exige_revisao_humana).length;
  console.log(`\n${gravado.itens.length} itens em docs/agentes/relatorios/latest.md`);
  if (humanos > 0) console.log(`${humanos} marcados como não delegáveis ao agente.`);
  for (const i of gravado.itens.slice(0, 5)) {
    console.log(`  P${i.prioridade} ${i.categoria.padEnd(14)} ${i.id}`);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
