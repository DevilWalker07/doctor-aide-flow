/**
 * npm run agente:consultor-medico
 *
 * Ferramenta consultiva, só para você. **Não é recurso do produto**: não tem
 * rota, não tem tela, não é chamada por nenhum código do app. Roda na sua
 * máquina e escreve em docs/agentes/consultor-medico/latest.md.
 *
 * A distinção importa. O que sai daqui é opinião de um modelo sobre fluxo de
 * trabalho — se isso aparecesse dentro do app, um médico poderia lê-lo como
 * orientação clínica validada, e não é.
 */

import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { commitAtual, lerRecortado, rotasDeIa } from "./lib/contexto.js";
import { cliente, json, modelo } from "./lib/ia.js";
import { RAIZ } from "./lib/limites.js";

const SugestaoSchema = z.object({
  titulo: z.string().trim().min(8).max(140),
  momento_do_plantao: z.string().trim().min(5).max(120),
  local: z.string().trim().min(2).max(80),
  atrito_hoje: z.string().trim().min(20).max(1200),
  proposta: z.string().trim().min(20).max(1600),
  /** Rotas de IA que já existem e servem para isto, lidas do código. */
  usa_rotas_existentes: z.array(z.string().trim()).max(10).default([]),
  ganho: z.enum(["tempo", "seguranca", "completude", "continuidade"]),
  confianca: z.enum(["alta", "media", "baixa"]),
});

const ConsultaSchema = z.object({
  leitura_geral: z.string().trim().min(40).max(2500),
  sugestoes: z.array(SugestaoSchema).min(1).max(20),
  perguntas_para_o_medico: z.array(z.string().trim().min(10).max(300)).max(10).default([]),
});
type Consulta = z.infer<typeof ConsultaSchema>;

const SYSTEM = `Você é um médico de plantão experiente no SUS, olhando um app feito por um colega
para uso próprio em plantão hospitalar. Ele quer sua opinião sobre FLUXO DE TRABALHO clínico:
onde o app atrapalha, onde falta um passo, o que ele pede na hora errada.

Pense no plantão de verdade: de pé, com uma mão, à noite, com pressa, interrompido no meio.
Passagem às 7h, round, alta que trava esperando documento, família perguntando no corredor.

Regras:
- Fale do fluxo, não de código. Nada de "refatorar", "extrair componente", "adicionar índice".
- Só cite rota de IA que está na lista que você recebeu. Não invente recurso.
- Diga o atrito de hoje antes da proposta. Sem atrito concreto, não é sugestão, é palpite.
- Se uma sugestão dependeria de dado que o app não tem, diga isso na própria proposta.
- confianca: "alta" só quando o atrito está visível no material que você recebeu.
- NÃO proponha nada que decida conduta pelo médico, calcule dose sozinho sem ele conferir,
  ou registre no prontuário sem revisão. O app é apoio, não substituto.

Responda APENAS JSON:
{ "leitura_geral": "...", "sugestoes": [ { "titulo": "...", "momento_do_plantao": "...",
  "local": "...", "atrito_hoje": "...", "proposta": "...", "usa_rotas_existentes": ["..."],
  "ganho": "tempo", "confianca": "media" } ], "perguntas_para_o_medico": ["..."] }`;

function paraMarkdown(c: Consulta, rotas: string[]): string {
  const linhas: string[] = [
    "# Consultor médico — fluxo de trabalho de plantão",
    "",
    `Gerado em ${new Date().toISOString()} · commit \`${commitAtual()}\` · modelo \`${modelo()}\``,
    "",
    "> **Ferramenta de bancada, não recurso do produto.** Isto não tem rota nem tela, e",
    "> não é chamado por nenhum código do app. É opinião de um modelo sobre fluxo de",
    "> trabalho, para você avaliar — não é orientação clínica validada.",
    "",
    "## Leitura geral",
    "",
    c.leitura_geral,
    "",
    "## Sugestões",
    "",
  ];

  const ordem = { alta: 0, media: 1, baixa: 2 };
  const sugestoes = [...c.sugestoes].sort((a, b) => ordem[a.confianca] - ordem[b.confianca]);

  for (const s of sugestoes) {
    linhas.push(
      `### ${s.titulo}`,
      "",
      `**Quando** ${s.momento_do_plantao} · **Onde** ${s.local} · **Ganho** ${s.ganho} · **Confiança** ${s.confianca}`,
      "",
      "**Atrito hoje.** " + s.atrito_hoje,
      "",
      "**Proposta.** " + s.proposta,
      "",
    );
    if (s.usa_rotas_existentes.length) {
      linhas.push(
        "**Já dá com o que existe:** " + s.usa_rotas_existentes.map((r) => `\`${r}\``).join(", "),
        "",
      );
    }
  }

  if (c.perguntas_para_o_medico.length) {
    linhas.push("## Perguntas para você responder", "");
    for (const p of c.perguntas_para_o_medico) linhas.push(`- ${p}`);
    linhas.push("");
  }

  linhas.push("## Rotas de IA existentes no momento desta consulta", "");
  for (const r of rotas) linhas.push(`- \`${r}\``);
  linhas.push("");

  return linhas.join("\n");
}

async function main(): Promise<void> {
  const rotas = rotasDeIa();
  const ambientes = lerRecortado("src/lib/ambientes.ts", 12_000) ?? "(sem ambientes.ts)";
  const openai = cliente();

  const user = [
    "## Locais de atendimento do app (fonte única)",
    ambientes,
    "",
    "## Rotas de IA que existem de verdade hoje",
    rotas.join("\n") || "(nenhuma)",
  ].join("\n");

  console.log(`Consultando com ${modelo()} sobre ${rotas.length} rotas…`);
  const consulta = await json(openai, SYSTEM, user, (v) => ConsultaSchema.parse(v));

  const destino = path.join(RAIZ, "docs/agentes/consultor-medico");
  fs.mkdirSync(destino, { recursive: true });
  fs.writeFileSync(path.join(destino, "latest.md"), paraMarkdown(consulta, rotas));

  console.log(
    `\n${consulta.sugestoes.length} sugestões em docs/agentes/consultor-medico/latest.md`,
  );
  for (const s of consulta.sugestoes.slice(0, 5)) {
    console.log(`  [${s.confianca}] ${s.titulo}`);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
