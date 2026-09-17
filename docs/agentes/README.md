# Agentes internos (`agents/`)

Três ferramentas de linha de comando, fora do app servido, que ajudam a decidir e
implementar o que melhorar no Medfluxo. Não são rotas HTTP, não têm UI e nenhum
médico usuário interage com elas — quem roda é você, o engenheiro, do seu
terminal (ou de um workflow de CI com checkout do repositório).

**Por que fora do app servido:** a API de produção é uma única função
serverless na Vercel (`api/[...rota].ts`), sem filesystem persistente entre
invocações e sem git. Um agente que lê o repositório inteiro e comita código
precisa de checkout completo e de um processo de vida longa — o oposto do que
uma função serverless oferece. Por isso essas ferramentas vivem como scripts
`tsx`, não como parte de `server/`.

## Os três agentes

### 1. Analista — `npm run agente:analisar`

Lê `CLAUDE.md`, `package.json`, as rotas, os schemas e a árvore de arquivos do
repositório, e devolve uma lista priorizada de melhorias (produto, segurança,
confiabilidade, performance, UX, DX). Grava em:

- `docs/agentes/relatorios/latest.md` — leitura humana.
- `docs/agentes/relatorios/latest.json` — o mesmo conteúdo, validado por
  schema (`agents/schemas.ts`), que o implementador consome.

Rodar de novo preserva o `status` dos itens já implementados (casa por `id`).

### 2. Implementador — `npm run agente:implementar -- --id <id>`

Pega um item do relatório (ou o primeiro `pendente`, se `--id` não for
passado) e implementa a mudança sozinho, com acesso de leitura/escrita ao
repositório via function calling. Sem `--id`, faz o próximo item pendente.

**Limites de segurança, por desenho:**

1. **Superfície de arquivo restrita** (`agents/lib/fsTools.ts`): nunca lê ou
   escreve em `.env*`, `.git`, `node_modules`, `private-data` ou `.github`
   (o próprio CI que valida o trabalho do agente fica fora do alcance dele).
2. **Só roda scripts de uma lista fechada** (`agents/lib/gitTools.ts`):
   `typecheck`, `lint`, `test:unit`, `format` — nunca um comando arbitrário
   vindo do modelo.
3. **Nunca commita na branch em que foi chamado.** Cria `agente/<id>` a
   partir da branch atual, e é nela que tudo acontece.
4. **O commit só existe se as checagens passarem de verdade.** Depois que o
   modelo termina, o próprio script — não o modelo — roda `typecheck`,
   `lint` e `test:unit`. Se algo falhar, nada é commitado; a branch fica com
   as alterações soltas para você inspecionar.
5. **Sem merge automático.** O agente empurra a branch (e abre PR, se
   `GITHUB_TOKEN`/`GITHUB_REPOSITORY` estiverem configurados) mas nunca toca
   em `main` — chegar a produção continua decisão humana.

Isso é "escreve e comita código sozinho" com o limite que faz sentido para um
app de uso médico real: autonomia até o PR, revisão humana para produção.

### 3. Consultor médico — `npm run agente:consultor-medico`

Ferramenta consultiva **só para você**, não para o produto. Lê os locais de
atendimento e atalhos reais (`src/lib/ambientes.ts`) e as rotas de IA
existentes, e devolve sugestões de melhoria de fluxo de trabalho sob a ótica
de um médico de plantão — o que atrasa à beira do leito, o que quebra
continuidade entre plantões, o que aumenta risco por informação mal
organizada. Grava em `docs/agentes/consultor-medico/latest.md`.

Não escreve código nem entra na fila do implementador diretamente — a ideia é
você ler, decidir o que vale a pena, e então (se fizer sentido) transformar
manualmente num item para o analista/implementador tratar.

## Fluxo sugerido

```bash
npm run agente:analisar              # gera/atualiza o relatório
cat docs/agentes/relatorios/latest.md
npm run agente:implementar -- --id rate-limit-copiloto   # implementa um item
# revisar o PR aberto, ou a branch `agente/rate-limit-copiloto`, e mergear manualmente

npm run agente:consultor-medico      # opcional: visão clínica para o backlog
```

## Variáveis de ambiente

Reaproveitam `OPENAI_API_KEY`/`OPENAI_MODEL` do `.env` do projeto. Opcionais,
em `.env.example`:

- `OPENAI_MODEL_AGENTES` — modelo específico para os agentes (cai em
  `OPENAI_MODEL` se ausente, mesmo padrão de `OPENAI_MODEL_VISAO`/
  `OPENAI_MODEL_COPILOTO`).
- `GITHUB_TOKEN` / `GITHUB_REPOSITORY` — para o implementador abrir PR
  automaticamente depois do push (útil rodando em GitHub Action). Sem eles,
  o push sozinho já é suficiente; abrir o PR manualmente é trivial.
