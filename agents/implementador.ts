#!/usr/bin/env tsx
/**
 * Agente implementador: pega um item do relatório do analista e escreve o
 * código da melhoria sozinho — leitura/escrita de arquivo e checagens via
 * function calling, git por fora do modelo.
 *
 * Fronteira de segurança, de propósito, nada sutil:
 *   1. Só mexe em arquivos dentro do repo, fora de `.env`, `.git`,
 *      `node_modules`, `private-data` e `.github` (ver `agents/lib/fsTools.ts`).
 *   2. Só roda os scripts do `package.json` da lista fechada em `gitTools.ts`
 *      (typecheck/lint/test:unit/format) — nunca um comando arbitrário.
 *   3. Commita e empurra para uma branch própria (`agente/<id>`), nunca para a
 *      branch em que o processo foi chamado. Não há merge automático: chegar a
 *      `main` — e portanto ao deploy de produção — continua decisão humana.
 *   4. Só commita se `typecheck`, `lint` e `test:unit` passarem de verdade,
 *      rodados por este script depois que o modelo terminar — não confia na
 *      palavra do modelo de que "os testes passam".
 */
import type {
  ChatCompletionFunctionTool,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import { modeloAgentes } from "../server/config.js";
import {
  getOpenAIClient,
  hasOpenAIKey,
  traduzirErroOpenAI,
} from "../server/services/openaiClient.js";
import { escreverArquivo, lerArquivo, listarArquivos } from "./lib/fsTools.js";
import {
  abrirPullRequestSePossivel,
  arvoreSuja,
  branchAtual,
  commitTudo,
  criarBranch,
  push,
  rodarVerificacao,
  voltarPara,
  type ScriptPermitido,
} from "./lib/gitTools.js";
import { lerRegistro, salvarRegistro } from "./lib/report.js";
import type { Registro, RegistroItem } from "./schemas.js";

const MAX_PASSOS = 20;

const TOOLS: ChatCompletionFunctionTool[] = [
  {
    type: "function",
    function: {
      name: "listar_arquivos",
      description: "Lista arquivos e subdiretórios de um diretório do repositório.",
      parameters: {
        type: "object",
        properties: {
          diretorio: { type: "string", description: "Caminho relativo à raiz do repo." },
        },
        required: ["diretorio"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ler_arquivo",
      description: "Lê o conteúdo de um arquivo do repositório (texto, até ~20 mil caracteres).",
      parameters: {
        type: "object",
        properties: { caminho: { type: "string" } },
        required: ["caminho"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "escrever_arquivo",
      description: "Sobrescreve (ou cria) um arquivo do repositório com o conteúdo completo dado.",
      parameters: {
        type: "object",
        properties: { caminho: { type: "string" }, conteudo: { type: "string" } },
        required: ["caminho", "conteudo"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rodar_verificacao",
      description:
        "Roda um script do package.json para conferir o próprio trabalho antes de finalizar.",
      parameters: {
        type: "object",
        properties: {
          script: { type: "string", enum: ["typecheck", "lint", "test:unit", "format"] },
        },
        required: ["script"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "finalizar",
      description:
        "Chame quando a implementação estiver completa e você já tiver rodado as checagens relevantes.",
      parameters: {
        type: "object",
        properties: { resumo: { type: "string", description: "O que foi mudado e por quê." } },
        required: ["resumo"],
      },
    },
  },
];

function executarFerramenta(nome: string, args: Record<string, unknown>): unknown {
  switch (nome) {
    case "listar_arquivos":
      return { arquivos: listarArquivos(String(args.diretorio ?? ".")) };
    case "ler_arquivo":
      return { conteudo: lerArquivo(String(args.caminho)) };
    case "escrever_arquivo":
      escreverArquivo(String(args.caminho), String(args.conteudo ?? ""));
      return { ok: true };
    case "rodar_verificacao":
      return rodarVerificacao(args.script as ScriptPermitido);
    default:
      throw new Error(`Ferramenta desconhecida: ${nome}`);
  }
}

function montarPromptDoItem(item: RegistroItem): string {
  return [
    `Item do relatório de análise a implementar (id: ${item.id}):`,
    `Título: ${item.titulo}`,
    `Categoria: ${item.categoria} | Prioridade: ${item.prioridade} | Esforço estimado: ${item.esforco}`,
    `Problema: ${item.problema}`,
    `Sugestão: ${item.sugestao}`,
    item.arquivos_relacionados.length
      ? `Arquivos apontados como relacionados (confira o conteúdo real antes de editar): ${item.arquivos_relacionados.join(", ")}`
      : "Nenhum arquivo específico foi apontado — explore o repositório com as ferramentas antes de editar.",
    "",
    "Implemente essa melhoria. Leia os arquivos relevantes antes de escrever. Rode `rodar_verificacao` com",
    "typecheck e test:unit pelo menos uma vez antes de chamar `finalizar`. Se uma checagem falhar, corrija e",
    "rode de novo — não chame `finalizar` com checagem quebrada.",
  ].join("\n");
}

async function rodarLoopDoAgente(system: string, itemPrompt: string): Promise<string> {
  const openai = getOpenAIClient();
  if (!openai) throw new Error("Cliente OpenAI indisponível.");
  const modelo = modeloAgentes();

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    { role: "user", content: itemPrompt },
  ];

  for (let passo = 0; passo < MAX_PASSOS; passo++) {
    const resposta = await openai.chat.completions
      .create({ model: modelo, temperature: 0.1, messages, tools: TOOLS, tool_choice: "auto" })
      .catch((err: unknown) => traduzirErroOpenAI(err, modelo));

    const mensagem = resposta.choices[0]?.message;
    if (!mensagem) throw new Error("Resposta vazia do modelo.");
    messages.push(mensagem);

    if (!mensagem.tool_calls?.length) {
      messages.push({
        role: "user",
        content:
          "Continue usando as ferramentas disponíveis, ou chame `finalizar` quando terminar.",
      });
      continue;
    }

    for (const chamada of mensagem.tool_calls) {
      if (chamada.type !== "function") {
        messages.push({
          role: "tool",
          tool_call_id: chamada.id,
          content: JSON.stringify({ erro: "Apenas ferramentas de função são suportadas." }),
        });
        continue;
      }
      if (chamada.function.name === "finalizar") {
        const args = JSON.parse(chamada.function.arguments || "{}") as { resumo?: string };
        return args.resumo ?? "(sem resumo)";
      }
      let resultado: unknown;
      try {
        const args = JSON.parse(chamada.function.arguments || "{}") as Record<string, unknown>;
        resultado = executarFerramenta(chamada.function.name, args);
      } catch (err) {
        resultado = { erro: err instanceof Error ? err.message : String(err) };
      }
      messages.push({ role: "tool", tool_call_id: chamada.id, content: JSON.stringify(resultado) });
    }
  }

  throw new Error(`Limite de ${MAX_PASSOS} passos atingido sem chamar finalizar.`);
}

function lerArgumentoId(): string | null {
  const args = process.argv.slice(2);
  const idx = args.findIndex((a) => a === "--id");
  if (idx >= 0 && args[idx + 1]) return args[idx + 1];
  const inline = args.find((a) => a.startsWith("--id="));
  return inline ? inline.slice("--id=".length) : null;
}

async function main() {
  if (!hasOpenAIKey()) {
    console.error("OPENAI_API_KEY ausente. Configure o .env antes de rodar.");
    process.exit(1);
  }

  const registroCarregado = lerRegistro();
  if (!registroCarregado) {
    console.error("Nenhum relatório encontrado. Rode `npm run agente:analisar` primeiro.");
    process.exit(1);
  }
  let registro: Registro = registroCarregado;

  const idPedido = lerArgumentoId();
  const item = idPedido
    ? registro.itens.find((i) => i.id === idPedido)
    : registro.itens.find((i) => i.status === "pendente");

  if (!item) {
    console.error(idPedido ? `Item "${idPedido}" não encontrado.` : "Nenhum item pendente.");
    process.exit(1);
  }
  if (item.status === "implementado") {
    console.error(`Item "${item.id}" já foi implementado (branch ${item.branch}).`);
    process.exit(1);
  }

  if (arvoreSuja()) {
    console.error(
      "Working tree com alterações não commitadas. Commite ou descarte antes de rodar o implementador " +
        "— ele não deve misturar seu trabalho com o do agente.",
    );
    process.exit(1);
  }

  const branchBase = branchAtual();
  const nomeBranch = `agente/${item.id}`;
  console.log(`[implementador] item: ${item.id} — ${item.titulo}`);
  console.log(`[implementador] criando branch ${nomeBranch} a partir de ${branchBase}…`);
  criarBranch(nomeBranch);

  const marcarStatus = (mudancas: Partial<RegistroItem>) => {
    registro = {
      ...registro,
      itens: registro.itens.map((i) =>
        i.id === item.id ? { ...i, ...mudancas, atualizado_em: new Date().toISOString() } : i,
      ),
    };
    salvarRegistro(registro);
  };

  marcarStatus({ status: "em_andamento", branch: nomeBranch });

  const SYSTEM_PROMPT = `Você é um engenheiro sênior implementando uma melhoria pontual no Medfluxo,
um assistente clínico para médicos de plantão hospitalar. Siga as regras do CLAUDE.md do projeto:
configuração antes de serviço, nenhuma saída de IA sem schema, guardrails clínicos determinísticos
(nunca no modelo), toda tabela com RLS, interface em português do Brasil, tokens de cor do
src/styles.css (nunca hex literal), alvo de toque mínimo 44x44px. Faça a menor mudança que resolve
o problema — sem refatorar o que não pediu, sem adicionar abstração especulativa. Use as ferramentas
disponíveis para explorar o código real antes de editar; nunca invente API que não existe.`;

  try {
    const resumo = await rodarLoopDoAgente(SYSTEM_PROMPT, montarPromptDoItem(item));
    console.log(`[implementador] modelo concluiu: ${resumo}`);

    console.log("[implementador] validando de verdade antes de commitar…");
    const checagens: ScriptPermitido[] = ["typecheck", "lint", "test:unit"];
    for (const script of checagens) {
      console.log(`  → npm run ${script}`);
      const resultado = rodarVerificacao(script);
      if (!resultado.ok) {
        throw new Error(`Checagem "${script}" falhou:\n${resultado.saida.slice(0, 6000)}`);
      }
    }

    if (!arvoreSuja()) {
      throw new Error("O modelo chamou finalizar sem alterar nenhum arquivo.");
    }

    const commit = commitTudo(`feat(agente): ${item.titulo} [${item.id}]\n\n${resumo}`);

    // Marca o item como implementado só depois do commit acima, com o hash
    // real — e isso vira um segundo commit pequeno, nunca um amend: reescrever
    // o commit que acabamos de fazer é o tipo de coisa que este agente não
    // decide sozinho.
    marcarStatus({ status: "implementado", commit, erro: null });
    commitTudo(`chore(agente): marca ${item.id} como implementado`);

    console.log(`[implementador] commit ${commit.slice(0, 10)} — empurrando…`);
    push(nomeBranch);

    const prUrl = await abrirPullRequestSePossivel({
      branch: nomeBranch,
      base: branchBase,
      titulo: `${item.titulo} [${item.id}]`,
      corpo: `${resumo}\n\n---\nGerado pelo agente implementador a partir do item \`${item.id}\` do relatório do agente analista.`,
    });
    if (prUrl) {
      marcarStatus({ pr_url: prUrl });
      commitTudo(`chore(agente): registra PR de ${item.id}`);
      push(nomeBranch);
    }

    voltarPara(branchBase);
    console.log(
      `[implementador] pronto. Branch \`${nomeBranch}\` empurrada${prUrl ? ` — PR: ${prUrl}` : ""}.`,
    );
    console.log(
      `[implementador] de volta em \`${branchBase}\`. Merge continua manual — este agente não decide o que vai para produção.`,
    );
  } catch (err) {
    const mensagem = err instanceof Error ? err.message : String(err);
    marcarStatus({ status: "falhou", erro: mensagem });
    console.error(`[implementador] falhou: ${mensagem}`);
    console.error(
      `[implementador] a branch "${nomeBranch}" ficou com as alterações (possivelmente incompletas) sem commit, ` +
        "para você inspecionar. Ela não foi empurrada.",
    );
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("[implementador] erro inesperado:", err);
  process.exit(1);
});
