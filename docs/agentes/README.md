# Agentes de manutenção

Três ferramentas de bancada. **Nenhuma é recurso do produto**: não têm rota,
não têm tela, e nenhum código do app as chama. Rodam na sua máquina.

```bash
npm run agente:analisar                      # relatório de melhorias
npm run agente:implementar -- --id <id>      # implementa um item, abre PR
npm run agente:consultor-medico              # opinião sobre fluxo de plantão
```

Precisam de `OPENAI_API_KEY` no ambiente ou no `.env` da raiz. Nenhum script
grava chave em disco. O modelo sai de `AGENTE_MODELO`, ou do `OPENAI_MODEL`.

## `agente:analisar`

Lê `CLAUDE.md`, as rotas de IA reais (extraídas de `ai.routes.ts`, não de
memória), `ai.schemas.ts`, `ambientes.ts`, `clinicalGuardrails.ts` e a árvore
do repositório. Grava `relatorios/latest.md` e `relatorios/latest.json`,
validados por Zod.

Itens que encostam em decisão clínica, prompt médico ou dado de paciente saem
marcados `exige_revisao_humana` — e o relatório **não** oferece o comando de
implementação para eles.

O relatório é leitura de um modelo sobre o código. Vale como pauta, não como
verdade.

## `agente:implementar`

Pega um item do relatório e implementa via function calling: ler, listar,
escrever arquivo, rodar script. Os limites estão **no código**
(`lib/limites.ts`, `lib/executar.ts`), não no prompt — limite em prompt é
pedido, e o modelo pode ignorar, ser convencido a ignorar, ou simplesmente
errar.

O que o script impede, não pede:

| Limite                                                                             | Onde                                      |
| ---------------------------------------------------------------------------------- | ----------------------------------------- |
| `.env*`, `.git`, `node_modules`, `private-data`, `.github`                         | `caminhoSeguro`                           |
| `package.json`, `tsconfig*`, `eslint.config.js`, `vitest.config.ts`, `.prettierrc` | `caminhoSeguro`                           |
| `scripts/agentes` — não reescreve os próprios limites                              | `caminhoSeguro`                           |
| Fuga por `..`, caminho absoluto, link simbólico                                    | `caminhoSeguro`, no caminho **resolvido** |
| Só `typecheck`, `lint`, `test:unit`, `format`                                      | `scriptPermitido`                         |
| Branch própria `agente/<id>`, nunca a atual                                        | `implementar.ts`                          |
| Commit só com o portão passando **de verdade**                                     | `portao()`                                |
| Sem merge automático                                                               | abre PR e para                            |

A segunda linha da tabela é o fecho de um buraco: a lista de scripts é por
nome, e o que cada nome executa mora no `package.json`. Com permissão de
escrever ali, o agente redefiniria `typecheck` como `exit 0` e o portão
passaria sem checar nada. Por isso `portao()` também confere que o diff não
encostou nesses arquivos antes de confiar no resultado.

O portão roda `typecheck`, `lint` e `test:unit` pelo script, e o que o modelo
diz sobre os testes não entra nessa decisão em ponto nenhum. `test:e2e` e
`build` ficam para você antes do merge.

Com `GITHUB_TOKEN` e `GITHUB_REPOSITORY` no ambiente, abre PR contra `main`.
Sem eles, para no push e diz. Autonomia até o PR; produção continua decisão
humana, porque isto é um app clínico.

## `agente:consultor-medico`

Lê `ambientes.ts` e as rotas de IA reais, e devolve sugestões de fluxo de
trabalho sob a ótica de um médico de plantão, em
`consultor-medico/latest.md`.

Cada sugestão precisa nomear o **atrito de hoje** antes da proposta: sem
atrito concreto não é sugestão, é palpite. Só pode citar rota que existe.

É opinião de um modelo sobre fluxo de trabalho, para você avaliar — não é
orientação clínica validada, e é por isso que não aparece dentro do app.
