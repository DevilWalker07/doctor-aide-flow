/**
 * npm run agente:implementar -- --id <id>
 *
 * Pega um item do relatório e implementa via function calling. Escreve,
 * commita e abre PR — e para aí. Merge em produção continua decisão sua.
 *
 * Os limites estão em `lib/limites.ts` e `lib/executar.ts`, em código. O
 * prompt só informa o modelo de que eles existem. Limite escrito em prompt é
 * pedido; este é impedimento.
 */

import fs from "node:fs";
import path from "node:path";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/index";
import { arvore } from "./lib/contexto.js";
import { arquivosAlterados, branchAtual, git, portao, rodarScript } from "./lib/executar.js";
import { cliente, modelo, passo } from "./lib/ia.js";
import {
  LIMITE_ESCRITA_BYTES,
  LimiteViolado,
  RAIZ,
  SCRIPTS_PERMITIDOS,
  caminhoSeguro,
} from "./lib/limites.js";
import { RelatorioSchema, type Item } from "./lib/relatorio.js";

const MAX_PASSOS = 30;

const FERRAMENTAS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "ler_arquivo",
      description: "Lê um arquivo do repositório. Caminho relativo à raiz.",
      parameters: {
        type: "object",
        properties: { caminho: { type: "string" } },
        required: ["caminho"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listar",
      description: "Lista arquivos sob um diretório do repositório.",
      parameters: {
        type: "object",
        properties: { diretorio: { type: "string" } },
        required: ["diretorio"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "escrever_arquivo",
      description:
        "Grava um arquivo inteiro. Envie o conteúdo completo, não um trecho. " +
        "Caminhos protegidos são recusados pelo próprio script.",
      parameters: {
        type: "object",
        properties: { caminho: { type: "string" }, conteudo: { type: "string" } },
        required: ["caminho", "conteudo"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rodar_script",
      description: `Roda um script do package.json. Permitidos: ${SCRIPTS_PERMITIDOS.join(", ")}.`,
      parameters: {
        type: "object",
        properties: { nome: { type: "string", enum: [...SCRIPTS_PERMITIDOS] } },
        required: ["nome"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "concluir",
      description: "Chame quando a implementação estiver pronta, com um resumo do que mudou.",
      parameters: {
        type: "object",
        properties: { resumo: { type: "string" } },
        required: ["resumo"],
        additionalProperties: false,
      },
    },
  },
];

function argumento(nome: string): string | undefined {
  const i = process.argv.indexOf(`--${nome}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function carregarItem(id: string): Item {
  const arquivo = path.join(RAIZ, "docs/agentes/relatorios/latest.json");
  if (!fs.existsSync(arquivo)) {
    throw new Error("Nenhum relatório encontrado. Rode `npm run agente:analisar` primeiro.");
  }
  const relatorio = RelatorioSchema.parse(JSON.parse(fs.readFileSync(arquivo, "utf-8")));
  const item = relatorio.itens.find((i) => i.id === id);
  if (!item) {
    throw new Error(
      `Item "${id}" não está no relatório. Disponíveis: ${relatorio.itens.map((i) => i.id).join(", ")}`,
    );
  }
  if (item.exige_revisao_humana) {
    throw new Error(
      `"${id}" está marcado como exige_revisao_humana: mexe em decisão clínica ou dado de ` +
        "paciente. Esse tipo de mudança não é delegável — implemente à mão.",
    );
  }
  return item;
}

function executar(nome: string, args: Record<string, unknown>): string {
  try {
    if (nome === "ler_arquivo") {
      const abs = caminhoSeguro(String(args.caminho));
      if (!fs.existsSync(abs)) return `Não existe: ${String(args.caminho)}`;
      const texto = fs.readFileSync(abs, "utf-8");
      return texto.length > 60_000 ? texto.slice(0, 60_000) + "\n[...recortado]" : texto;
    }

    if (nome === "listar") {
      const abs = caminhoSeguro(String(args.diretorio));
      if (!fs.existsSync(abs)) return `Não existe: ${String(args.diretorio)}`;
      return arvore(abs, String(args.diretorio), 2).join("\n") || "(vazio)";
    }

    if (nome === "escrever_arquivo") {
      const rel = String(args.caminho);
      const abs = caminhoSeguro(rel);
      const conteudo = String(args.conteudo ?? "");
      if (conteudo.length > LIMITE_ESCRITA_BYTES) {
        return `Recusado: ${conteudo.length} bytes passa do limite de ${LIMITE_ESCRITA_BYTES}.`;
      }
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, conteudo);
      return `Gravado: ${rel} (${conteudo.length} bytes)`;
    }

    if (nome === "rodar_script") {
      const r = rodarScript(String(args.nome));
      const cauda = r.saida.split("\n").slice(-60).join("\n");
      return `${r.ok ? "ok" : "falhou"}\n${cauda}`;
    }

    if (nome === "concluir") return "ok";
    return `Ferramenta desconhecida: ${nome}`;
  } catch (err) {
    if (err instanceof LimiteViolado) return err.message;
    return `Erro: ${err instanceof Error ? err.message : String(err)}`;
  }
}

async function main(): Promise<void> {
  const id = argumento("id");
  if (!id) throw new Error("Uso: npm run agente:implementar -- --id <id>");

  const item = carregarItem(id);
  const origem = branchAtual();
  const branch = `agente/${id}`;

  // Nunca na branch atual: se der errado, o seu trabalho não está no caminho.
  if (arquivosAlterados().length > 0) {
    throw new Error(
      "Há alterações não commitadas. O agente cria a própria branch a partir de um " +
        "estado limpo — commite ou guarde o que está em andamento antes.",
    );
  }
  const criou = git("checkout", "-b", branch);
  if (!criou.ok) {
    const trocou = git("checkout", branch);
    if (!trocou.ok) throw new Error(`Não consegui criar nem usar a branch ${branch}.`);
  }
  console.log(`Branch ${branch} (de ${origem}). Implementando "${item.titulo}"…`);

  const openai = cliente();
  const mensagens: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: [
        "Você implementa UMA melhoria no Medfluxo, um assistente clínico para médicos de plantão.",
        "",
        "Regras da casa estão no CLAUDE.md — leia antes de escrever. Contrariá-lo é erro.",
        "",
        "Limites aplicados pelo script, não por você:",
        "- .env*, .git, node_modules, private-data, .github são recusados na escrita.",
        "- package.json, tsconfig*, eslint.config.js e vitest.config.ts também: eles definem",
        "  o que typecheck, lint e test:unit fazem, e você não afrouxa a régua que te mede.",
        `- Só estes scripts rodam: ${SCRIPTS_PERMITIDOS.join(", ")}.`,
        "- Nada é commitado se typecheck, lint e test:unit não passarem de verdade. Quem roda",
        "  é o script, no fim — sua opinião sobre os testes não entra nessa decisão.",
        "",
        "Como trabalhar: leia os arquivos relevantes antes de mudar; escreva o arquivo inteiro;",
        "rode typecheck e test:unit você mesmo para se corrigir; acrescente ou ajuste teste",
        "quando a mudança tiver comportamento observável. Ao terminar, chame concluir.",
        "",
        "Se a tarefa precisar de algo fora dos limites (dependência nova, mudança de config),",
        "não tente contornar: chame concluir explicando o que falta.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `# Item ${item.id}`,
        `**${item.titulo}** (${item.categoria}, P${item.prioridade}, esforço ${item.esforco})`,
        "",
        "## Problema",
        item.problema,
        "",
        "## Proposta",
        item.proposta,
        "",
        "## Critério de aceite",
        ...item.criterio_de_aceite.map((c) => `- ${c}`),
        "",
        item.arquivos.length ? `## Arquivos indicados\n${item.arquivos.join("\n")}` : "",
      ].join("\n"),
    },
  ];

  let resumo = "";
  for (let i = 0; i < MAX_PASSOS; i++) {
    const p = await passo(openai, mensagens, FERRAMENTAS);
    mensagens.push(p.mensagem);

    if (p.ferramentas.length === 0) {
      resumo = p.texto ?? "";
      break;
    }

    for (const chamada of p.ferramentas) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(chamada.argumentos) as Record<string, unknown>;
      } catch {
        /* argumento inválido cai no executar e volta como erro */
      }
      const saida = executar(chamada.nome, args);
      console.log(
        `  ${chamada.nome}(${String(args.caminho ?? args.nome ?? args.diretorio ?? "")})`,
      );
      mensagens.push({ role: "tool", tool_call_id: chamada.id, content: saida });
      if (chamada.nome === "concluir") resumo = String(args.resumo ?? "");
    }

    if (resumo) break;
  }

  const alterados = arquivosAlterados();
  if (alterados.length === 0) {
    console.log("\nNada foi alterado. Voltando para a branch de origem.");
    git("checkout", origem);
    git("branch", "-D", branch);
    console.log(resumo ? `O agente disse: ${resumo}` : "");
    return;
  }

  console.log(`\nAlterados: ${alterados.join(", ")}`);
  rodarScript("format");

  console.log("\nPortão: typecheck, lint e test:unit…");
  const { ok, relatorio } = portao();
  for (const l of relatorio) console.log(l);

  if (!ok) {
    console.error(
      "\nPortão reprovou. As alterações ficam na branch " +
        `${branch}, não commitadas, para você olhar. Nada foi empurrado.`,
    );
    process.exit(1);
  }

  git("add", "-A");
  const mensagem = [
    `${item.categoria === "dx" ? "chore" : "feat"}(agente): ${item.titulo}`,
    "",
    resumo || item.proposta,
    "",
    `Item ${item.id} do relatório de docs/agentes/relatorios/latest.md.`,
    "Implementado por npm run agente:implementar, com typecheck, lint e",
    "test:unit passando antes do commit. Não mergeado: revisão é humana.",
    "",
    `Co-Authored-By: Agente Medfluxo <noreply@medfluxo.local>`,
  ].join("\n");
  const commitado = git("commit", "-m", mensagem);
  if (!commitado.ok) {
    console.error("Falhou ao commitar:\n" + commitado.saida);
    process.exit(1);
  }

  const empurrado = git("push", "-u", "origin", branch);
  if (!empurrado.ok) {
    console.log(`\nCommitado em ${branch}. Não empurrei: ${empurrado.saida.split("\n")[0]}`);
    return;
  }

  await abrirPr(branch, item, resumo);
  console.log(`\nPronto. Branch ${branch} empurrada. Merge em main continua decisão sua.`);
}

async function abrirPr(branch: string, item: Item, resumo: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) {
    console.log(
      "\nGITHUB_TOKEN/GITHUB_REPOSITORY não configurados: PR não aberto. " +
        `Abra manualmente a partir de ${branch}.`,
    );
    return;
  }

  const corpo = [
    `Item \`${item.id}\` do relatório em \`docs/agentes/relatorios/latest.md\`.`,
    "",
    "## Problema",
    item.problema,
    "",
    "## O que foi feito",
    resumo || item.proposta,
    "",
    "## Critério de aceite",
    ...item.criterio_de_aceite.map((c) => `- [ ] ${c}`),
    "",
    "---",
    "",
    "Aberto por `npm run agente:implementar`. `typecheck`, `lint` e `test:unit`",
    "passaram antes do commit — rodados pelo script, não relatados pelo modelo.",
    "`test:e2e` e `build` **não** foram rodados: rode antes de mergear.",
    "",
    "Sem merge automático, de propósito: este é um app clínico.",
  ].join("\n");

  const res = await fetch(`https://api.github.com/repos/${repo}/pulls`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: `${item.titulo}`, head: branch, base: "main", body: corpo }),
  });

  if (!res.ok) {
    console.log(
      `\nNão consegui abrir o PR (${res.status}). Abra manualmente a partir de ${branch}.`,
    );
    return;
  }
  const pr = (await res.json()) as { html_url?: string };
  console.log(`\nPR aberto: ${pr.html_url ?? "(sem url)"}`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
