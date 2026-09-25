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
  que injeta o token do Supabase. **O endereço da API não é configurável**: é
  sempre o mesmo domínio, porque a API é uma função servida junto com o app.
  Existia um `VITE_CLINICAL_AGENTS_URL` da época do Railway, e uma variável
  sobrando apontando para o host antigo mandava todo fetch do navegador para um
  serviço inexistente — com o `/health` consultado de fora respondendo 200. Não
  reintroduza base de API por ambiente.
- Chaves de localStorage têm prefixo `da_` e ficam centralizadas em `src/lib/storage.ts`.

## Deploy

Tudo na Vercel — projeto `medfluxo`, branch de produção `main`, domínio
`medfluxo.vercel.app`. Não existe segundo serviço: o backend do Railway saiu, e
ele tinha caído sem ninguém perceber justamente porque não estava escrito aqui.

- **Frontend** — build do Vite em `dist`, servido pelo CDN.
- **API** — uma única função em `api/index.ts`, que monta
  `createServerlessApp()` de `server/serverless.ts`. É a mesma aplicação de
  `server/app.ts` sem o que não cabe em função: `/api/extract` e
  `/api/passagem-plantao` (corpo de 20 MB e execução longa) respondem 503 com
  motivo até as fases seguintes. `aiRouter`, prompts, schemas e guardrails são
  os mesmos — a função é só a casca.
- `server/index.ts` continua sendo o servidor local (`npm run dev:all`).

**O roteamento da API é explícito no `vercel.json`, nunca por convenção.**
Era `api/[...rota].ts`, catch-all por nome de arquivo, e ele casava **um**
segmento só. Como todo endpoint real é aninhado (`/api/ai/copiloto`,
`/api/extract/preparar-upload`, `/api/passagem-plantao/gerar`), a API inteira
respondeu 404 em produção por semanas — só `/api/health` escapava, por ter um
segmento. A borda devolvia `x-vercel-error: NOT_FOUND` em texto puro e a função
nem rodava. Hoje o rewrite `"/api/(.*)" → "/api/index"` manda tudo para a
função, e `server/serverless.ts` normaliza o caminho para `/api/...` — assim a
aplicação não depende de o rewrite preservar o prefixo.

Detalhe que também mordeu: a chave de `functions` é **glob**, e em glob
`[...rota]` é classe de caracteres, não nome de arquivo. A chave nunca casou, e
o `maxDuration: 60` provavelmente nunca foi aplicado. Chave de `functions` sem
colchetes.

**Dependência que o empacotador não rastreia precisa ser pedida à mão.** O
pdf.js monta um "fake worker" com `import(workerSrc)` marcado
`webpackIgnore: true` / `@vite-ignore` — a própria biblioteca manda o bundler
ignorar. A função foi publicada sem `pdf.worker.mjs` e todo PDF falhava com
`Cannot find module` em `/var/task/...`, enquanto aqui passava: no disco o
`node_modules` está inteiro e o import resolve. `loadPdfJs`
(`server/services/pdf.service.ts`) importa o worker com string literal e o
registra em `globalThis.pdfjsWorker`, fechando as duas pontas — o arquivo entra
no pacote e o caminho do import ignorado nunca roda. `includeFiles` no
`vercel.json` é o cinto além do suspensório. O teste não afirma "extraiu
texto": afirma que o worker **foi registrado**, que é o que separa produção de
local.

**Nada de biblioteca para ler assinatura de arquivo.** Era `file-type`, e a
cadeia dele (`strtok3` → `@tokenizer/token`, mais `token-types` e
`@tokenizer/inflate`) não sobrevive ao empacotamento: `strtok3` declara exports
condicionais (`{"node": "./lib/index.js", "default": "./lib/core.js"}`), o
rastreador da Vercel levou o `core.js` da condição `default` e o Node, em
execução, pediu o `index.js` da condição `node`. Toda leitura de arquivo morria
com `Cannot find module` — e aqui nunca falhava, porque no disco o
`node_modules` está inteiro. `assinaturaDe` (`server/lib/files.ts`) lê os
primeiros 16 bytes e cobre os oito formatos que o app aceita. `includeFiles`
não resolveria: seria enumerar uma árvore de dependências à mão.

**Formato de arquivo se decide pelos bytes, nunca pela extensão.** A rota de
extração já usava `sniffKind` (`server/lib/files.ts`); a da passagem despachava
por `extOf(originalName)`, e um Word chamado `.pdf` ia para o leitor de PDF e
falhava reclamando da estrutura do PDF — erro que não aponta para a causa. O
nome do arquivo é dado de entrada e não está sob o nosso controle; o conteúdo
está. `extractTextFromFile` (`server/services/textExtraction.service.ts`)
fareja e despacha pelo conteúdo; a extensão só vale para `.txt`/`.md`, que não
têm assinatura. Quando os dois discordam, o arquivo é lido pelo conteúdo **e**
entra um aviso na lista que a tela mostra — extensão errada que se repete é
coisa que o médico precisa saber.

**Teste local não vê o roteamento da Vercel.** Os 235 testes e os 26 specs rodam
contra `server/app.ts`, onde o Express roteia tudo — por isso ficaram verdes com
a produção morta. `npm run verificar:producao` sonda os caminhos **aninhados** no
ar e exige que a resposta venha da nossa aplicação (JSON nosso) e não da borda
(`x-vercel-error`). Rode depois de todo deploy; 404 nosso passa, 404 da
plataforma reprova.

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

**A passagem era a exceção, e por isso quebrou.** `processarAteOFim` rodava
TODOS os lotes num laço, numa invocação só: quatro lotes não cabem em 60 s. Em
produção o job ficou em "Lendo lote 2 de 4", sem erro, com o parcial salvo, e a
tela girou até desistir. Hoje o laço trabalha com `passagemBudgetMs()` e só
começa outro lote se houver folga para ele terminar — meio lote é trabalho
perdido. Estourar o prazo **não é erro**: é "faltam lotes", e
`POST /api/passagem-plantao/job/:id/continuar` retoma de onde parou, quantas
invocações forem necessárias. O cliente conduz, uma chamada por vez.

**Job que parou de andar vira erro na consulta.** `processing` sem atualização
há mais de 90 s é dado como interrompido, com o estágio onde parou. Job vivo
atualiza o `updated_at` a cada lote, então só envelhece quem de fato parou —
e spinner eterno deixa de ser um estado possível.

**Upload de documento não passa pelo servidor.** O navegador envia direto ao
bucket privado `documentos-clinicos` (migration `20260917000000`), num caminho
prefixado por `auth.uid()`; a rota recebe só `storage_path`. O backend usa a
service role, que **ignora RLS** — por isso `validarCaminho`
(`server/lib/storageDocumentos.ts`) confere o dono também no código. O objeto é
apagado depois de processado. `/api/extract/preparar-upload` diz ao cliente qual
modo usar: sem Supabase (modo local, `npm run dev:all`) o contêiner aceita
multipart; a função serverless, não.

**Parâmetro recusado pelo modelo se descobre, não se adivinha — e a classe
inteira, não um por vez.** Modelos novos recusam ajustes que os antigos
aceitavam: `max_tokens` (use `max_completion_tokens`), `temperature` (só o
padrão). Cada 400 desses derruba TODA chamada de IA. Lista de nomes de modelo
não resolve: o identificador vem de variável de ambiente e muda quando o modelo
muda. `chamarModelo` (`server/services/openaiClient.ts`) lê o nome do parâmetro
na própria mensagem da API (`Unsupported parameter|value: '<nome>'`), adapta o
perfil daquele modelo e repete — trocando o nome do limite de saída, ou
omitindo o ajuste. Teto de 3 adaptações por chamada; 400 sem nome de parâmetro
sobe intacto.

**`response_format` nunca entra na lista do que pode ser descartado.** Só
ajustes entram (`temperature`, `top_p`, penalidades, os dois de limite). Sem o
contrato de JSON a IA devolve texto livre, o schema rejeita e o app ficaria
reparando algo que nunca ia validar — quando a IA não pode cumprir o contrato,
a chamada falha. Descartar em silêncio o que sustenta o dado clínico é o
oposto da regra dos schemas.

**Consequência a não esquecer:** com `temperature` omitida o modelo roda no
padrão, e duas execuções sobre os mesmos arquivos podem redigir diferente.
Quem protege o conteúdo continua sendo o schema e os guardrails; o que se perde
é reprodutibilidade. Modelo que aceite `temperature` devolve isso.

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

## Agentes de manutenção

Três ferramentas de bancada em `scripts/agentes/`, documentadas em
`docs/agentes/README.md`. Não são recurso do produto: sem rota, sem tela, e
nenhum código do app as chama.

```bash
npm run agente:analisar
npm run agente:implementar -- --id <id>
npm run agente:consultor-medico
```

**Limite de agente vai no código, nunca no prompt.** `scripts/agentes/lib/limites.ts`
é o que impede a escrita; o prompt só informa que o limite existe. A checagem é
no caminho **resolvido**, porque `src/../.env` só parece inofensivo antes de
resolver.

**A régua não é editável por quem ela mede.** `package.json`, os `tsconfig`, o
`eslint.config.js` e o `vitest.config.ts` são bloqueados para o agente, e
`portao()` confere que o diff não os tocou antes de confiar no resultado dos
testes — senão bastaria redefinir `typecheck` como `exit 0`.

**O portão roda de verdade.** `typecheck`, `lint` e `test:unit` são executados
pelo script, e o que o modelo diz sobre eles não entra na decisão de commitar.
Sem merge automático: abre PR e para.

## Segurança

Documentos de pacientes reais **nunca** entram no repositório — `/*.docx` e
`private-data/` estão no `.gitignore`. Fixtures e seeds usam dados fictícios.
