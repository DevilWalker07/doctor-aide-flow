# Arquitetura - DOUTOR AJUDA / HNAS ASSIST

## Visão Geral

O app segue uma arquitetura local-first:

- `src/routes`: telas do TanStack Router.
- `src/components`: componentes visuais.
- `src/lib/store.ts`: persistência local/Supabase com fallback automático.
- `src/lib/types`: tipos centrais de paciente, laboratório, evolução, round e Motor Luan.
- `src/lib/medical`: cálculos clínicos determinísticos locais.
- `src/lib/ai`: cliente frontend seguro para o backend de IA.
- `server`: backend local Express que atua como AI broker.

## Fluxo Local-First

1. A interface funciona mesmo sem Supabase e sem IA real.
2. Dados clínicos são salvos em `localStorage`.
3. Quando `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` existem, a store tenta sincronizar com Supabase.
4. Se Supabase falhar, o app mantém o fallback local.

## Backend AI Broker

O frontend nunca chama OpenAI diretamente e nunca recebe `OPENAI_API_KEY`.

O frontend chama:

```txt
VITE_AI_BACKEND_URL=http://localhost:8787
```

O backend lê:

```txt
OPENAI_API_KEY=
OPENAI_MODEL=
```

Se `OPENAI_API_KEY` não existir, o backend retorna mocks seguros.

## Como Rodar

Frontend:

```bash
npm run dev
```

Backend:

```bash
npm run server:dev
```

Tudo junto:

```bash
npm run dev:all
```

## Sem IA Real

Não configure `server/.env`. O backend e o frontend usam mocks/fallbacks locais.

## Com IA Real

1. Copiar `server/.env.example` para `server/.env`.
2. Preencher `OPENAI_API_KEY`.
3. Opcionalmente preencher `OPENAI_MODEL`.
4. Rodar `npm run server:dev`.

## Endpoints

- `GET /health`
- `POST /api/ai/orquestrador`
- `POST /api/ai/extrair-clinica-medica`
- `POST /api/ai/extrair-pediatria`
- `POST /api/ai/extrair-uti`
- `POST /api/ai/gerar-evolucao`
- `POST /api/ai/importar-evolucoes-ontem`
- `POST /api/ai/gerar-mapa-plantao`
- `POST /api/ai/gerar-briefing`

Endpoints antigos seguem ativos como compatibilidade.
