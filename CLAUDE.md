# Medfluxo — guia para agentes

Assistente clínico para médicos de plantão hospitalar. Extrai dados de documentos,
gera evoluções, passagem de plantão e documentos ambulatoriais.

## Comandos

```bash
npm run dev:all       # Vite (5173) + Express (8787)
npm run typecheck     # os três tsconfig — sempre antes de commitar
npm run lint
npm run format        # Prettier; formatação é responsabilidade dele, não sua
npm test              # Vitest (projetos server + client)
npm run test:e2e      # Playwright
npm run build
```

`AI_MOCK=1` faz o backend responder com as fixtures de `server/mocks/aiFixtures.ts`,
sem chamar a OpenAI. É assim que os testes e2e rodam.

## Arquitetura

- **Frontend** — React 19, TanStack Router (rotas baseadas em arquivo em `src/routes/`;
  `routeTree.gen.ts` é **gerado**, nunca edite), Vite 7, Tailwind v4.
- **Backend** — Express 5 em `server/`. `server/index.ts` só sobe o servidor; a app
  vive em `server/app.ts` para os testes montarem via supertest.
- **Banco** — Supabase (Postgres + RLS). Migration canônica em
  `supabase/migrations/20260915000000_canonical_schema.sql`.
- **IA** — OpenAI. Prompts em `server/prompts/`, orquestração em
  `server/services/motorLuan.service.ts`, rotas em `server/routes/ai.routes.ts`.

## Regras que não se negociam

**Configuração antes de serviço.** `server/config.ts` carrega o `.env` e valida o
ambiente com Zod. Todo import de serviço vem _depois_ dele — o hoisting de ESM já
fez o `OPENAI_MODEL` ser ignorado em silêncio uma vez. Leia o ambiente por `env`,
nunca por `process.env` direto.

**Nenhuma saída de IA entra no app sem schema.** Use `safeJsonCompletion` com um
schema de `server/schemas/ai.schemas.ts`. Ele checa `finish_reason`, valida e tenta
reparar uma vez. Quando a IA falha, a chamada falha — **nunca** devolva dado
sintético no lugar de dado clínico.

**Guardrails são determinísticos.** Limiares de laboratório, sinais vitais, contagem
de dias de antibiótico e clearance ficam em `server/services/clinicalGuardrails.ts`
e `shared/medical/labThresholds.ts`, em TypeScript puro e testado. O modelo não
decide se um potássio é crítico.

**Adicionar campo ao corpo de uma rota exige mexer no schema.** O Zod usa `strip`:
um campo ausente do schema é descartado em silêncio e o bug aparece como
"a IA ignorou o que eu mandei".

**Toda tabela tem RLS com `USING` e `WITH CHECK`.** Só `USING` deixa o usuário
gravar linha alheia.

## UI

O app é usado de pé, com pressa, com uma mão, muitas vezes à noite. Isso dita o estilo:

- **Nada abaixo de 13 px** em texto que precise ser lido. Use as classes de
  `src/styles.css`: `.t-display`, `.t-title`, `.t-body`, `.t-label`, `.t-eyebrow`.
- **Caixa alta só em `.t-eyebrow`** (chapéu de seção). Em nome, descrição, botão ou
  mensagem, caixa alta destrói a forma da palavra e atrasa a leitura.
  Exceção: o _conteúdo clínico_ das evoluções é maiúsculo por convenção médica —
  isso é dado, não interface.
- **Alvo de toque mínimo 44 × 44 px.** O ícone pode ter 20 px; a área clicável, não.
- **Os dois temas precisam funcionar.** Cores vêm dos tokens em `src/styles.css`,
  nunca de hex literal — o bloco `.dark` redefine a paleta inteira.
- Todo botão só-ícone leva `aria-label`; tudo focável mostra `focus-visible:ring-2`.

## Convenções

- Interface em **português do Brasil**, inclusive nomes de rota (`/iniciar-plantao`).
- `src/lib/ambientes.ts` é a **fonte única** dos ambientes e subambientes. Telas,
  formulários e seeds leem daí.
- Chamadas HTTP do cliente passam por `apiJson`/`apiFetch` de `src/lib/apiClient.ts`,
  que injeta o token do Supabase.
- Chaves de localStorage têm prefixo `da_` e ficam centralizadas em `src/lib/storage.ts`.

## Deploy

Tudo na Vercel — projeto `medfluxo`, branch de produção `main`, domínio
`medfluxo.vercel.app`. Não existe segundo serviço: o backend do Railway saiu, e
ele tinha caído sem ninguém perceber justamente porque não estava escrito aqui.

- **Frontend** — build do Vite em `dist`, servido pelo CDN.
- **API** — uma única função em `api/[...rota].ts`, que monta
  `createServerlessApp()` de `server/serverless.ts`. É a mesma aplicação de
  `server/app.ts` sem o que não cabe em função: `/api/extract` e
  `/api/passagem-plantao` (corpo de 20 MB e execução longa) respondem 503 com
  motivo até as fases seguintes. `aiRouter`, prompts, schemas e guardrails são
  os mesmos — a função é só a casca.
- `server/index.ts` continua sendo o servidor local (`npm run dev:all`).

**Variáveis no projeto da Vercel** (Production e Preview):
`OPENAI_API_KEY`, `OPENAI_MODEL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`ALLOWED_ORIGINS`. Opcionais: `OPENAI_MODEL_VISAO`, `OPENAI_MODEL_COPILOTO`,
`EXTRACT_BUDGET_MS`.

**Trabalho depois da resposta precisa de `waitUntil`.** Em função serverless tudo
que roda após a resposta HTTP é interrompido. `/api/extract` devolve 202 e
processa em seguida — sem o `waitUntil` injetado por `server/serverless.ts`, o
job ficaria preso em `processing` e a tela de progresso giraria para sempre.
Todo job assíncrono novo passa por ali, e leva um orçamento de tempo
(`extractBudgetMs`) **abaixo** do `maxDuration`, porque job cortado pela
plataforma não tem quem o marque como erro.

**Upload de documento não passa pelo servidor.** O navegador envia direto ao
bucket privado `documentos-clinicos` (migration `20260917000000`), num caminho
prefixado por `auth.uid()`; a rota recebe só `storage_path`. O backend usa a
service role, que **ignora RLS** — por isso `validarCaminho`
(`server/lib/storageDocumentos.ts`) confere o dono também no código. O objeto é
apagado depois de processado. `/api/extract/preparar-upload` diz ao cliente qual
modo usar: sem Supabase (modo local, `npm run dev:all`) o contêiner aceita
multipart; a função serverless, não.

**Modelo de IA por finalidade.** `OPENAI_MODEL_VISAO` vale para leitura de
imagem — foto de prontuário e OCR de PDF — e `OPENAI_MODEL_COPILOTO` para o
copiloto; ausentes, caem em `OPENAI_MODEL`. A separação existe porque um número
lido errado na foto atravessa o Zod e os guardrails sem ser notado: está errado
na origem. Texto já extraído não corre esse risco.

**Configuração incompleta não derruba o processo.** `server/config.ts` junta os
motivos em `configErrors` e `configOk()`; o handler responde **503 com o
motivo**, e `useBackendHealth` acende a faixa no hub. Antes era `process.exit(1)`
— o serviço morria calado no boot. Nunca volte a sair do processo por
configuração ausente em caminho servido por requisição.

## Segurança

Documentos de pacientes reais **nunca** entram no repositório — `/*.docx` e
`private-data/` estão no `.gitignore`. Fixtures e seeds usam dados fictícios.
