/**
 * Esquema do relatório de melhorias.
 *
 * Mesmo princípio que vale no app: nenhuma saída de IA entra sem schema. Um
 * relatório com campo faltando é pior que relatório nenhum — o
 * `agente:implementar` leria `undefined` como instrução.
 */

import { z } from "zod";

export const CATEGORIAS = [
  "produto",
  "seguranca",
  "confiabilidade",
  "performance",
  "ux",
  "dx",
] as const;

export const ItemSchema = z.object({
  /** Estável e usável em nome de branch: kebab-case, sem acento. */
  id: z
    .string()
    .trim()
    .min(3)
    .max(48)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "id deve ser kebab-case sem acento"),
  titulo: z.string().trim().min(8).max(120),
  categoria: z.enum(CATEGORIAS),
  /** 1 = mexer agora, 5 = quando sobrar tempo. */
  prioridade: z.number().int().min(1).max(5),
  /** O que está errado hoje, com evidência. */
  problema: z.string().trim().min(20).max(1200),
  /** O que fazer. Concreto o suficiente para o implementador agir. */
  proposta: z.string().trim().min(20).max(2000),
  arquivos: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
  /** Como saber que ficou pronto. */
  criterio_de_aceite: z.array(z.string().trim().min(5).max(400)).min(1).max(10),
  esforco: z.enum(["pequeno", "medio", "grande"]),
  /**
   * Itens que mexem em decisão clínica ou em dado de paciente não são para o
   * agente implementar sozinho, por mais bem descritos que estejam.
   */
  exige_revisao_humana: z.boolean().default(false),
});
export type Item = z.infer<typeof ItemSchema>;

export const RelatorioSchema = z.object({
  resumo: z.string().trim().min(20).max(2000),
  itens: z.array(ItemSchema).min(1).max(40),
});
export type Relatorio = z.infer<typeof RelatorioSchema>;

export interface RelatorioGravado extends Relatorio {
  gerado_em: string;
  commit: string;
  modelo: string;
}

export function ordenar(itens: Item[]): Item[] {
  const peso: Record<(typeof CATEGORIAS)[number], number> = {
    seguranca: 0,
    confiabilidade: 1,
    produto: 2,
    ux: 3,
    performance: 4,
    dx: 5,
  };
  return [...itens].sort(
    (a, b) => a.prioridade - b.prioridade || peso[a.categoria] - peso[b.categoria],
  );
}

export function paraMarkdown(r: RelatorioGravado): string {
  const linhas: string[] = [
    "# Relatório de melhorias",
    "",
    `Gerado em ${r.gerado_em} · commit \`${r.commit}\` · modelo \`${r.modelo}\``,
    "",
    "> Gerado por `npm run agente:analisar`. É leitura de um modelo sobre o",
    "> repositório — vale como pauta, não como verdade. Confira antes de agir.",
    "",
    "## Resumo",
    "",
    r.resumo,
    "",
    "## Itens",
    "",
    "| # | id | prioridade | categoria | esforço | título |",
    "| --- | --- | --- | --- | --- | --- |",
  ];

  const itens = ordenar(r.itens);
  itens.forEach((i, n) => {
    const marca = i.exige_revisao_humana ? " ⚑" : "";
    linhas.push(
      `| ${n + 1} | \`${i.id}\` | P${i.prioridade} | ${i.categoria} | ${i.esforco} | ${i.titulo}${marca} |`,
    );
  });

  linhas.push("", "⚑ = mexe em decisão clínica ou dado de paciente: não delegue ao agente.", "");

  for (const i of itens) {
    linhas.push(
      `### \`${i.id}\` — ${i.titulo}`,
      "",
      `**P${i.prioridade} · ${i.categoria} · esforço ${i.esforco}**` +
        (i.exige_revisao_humana ? " · ⚑ exige revisão humana" : ""),
      "",
      "**Problema.** " + i.problema,
      "",
      "**Proposta.** " + i.proposta,
      "",
    );
    if (i.arquivos.length) {
      linhas.push("**Arquivos.** " + i.arquivos.map((a) => `\`${a}\``).join(", "), "");
    }
    linhas.push("**Critério de aceite.**", "");
    for (const c of i.criterio_de_aceite) linhas.push(`- ${c}`);
    linhas.push(
      "",
      i.exige_revisao_humana
        ? "_Implementação manual._"
        : `Implementar: \`npm run agente:implementar -- --id ${i.id}\``,
      "",
    );
  }

  return linhas.join("\n");
}
