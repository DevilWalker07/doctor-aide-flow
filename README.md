# DOUTOR AJUDA / HNAS ASSIST

Sistema médico pessoal para evolução clínica, round de enfermaria, importação de laboratórios e mapa de passagem de plantão.

## Instalar

```bash
npm install
```

## Rodar frontend

```bash
npm run dev
```

## Rodar backend local de IA

```bash
npm run server:dev
```

Para rodar tudo em um terminal:

```bash
npm run dev:all
```

## Usar com IA real

1. Copie `server/.env.example` para `server/.env`.
2. Preencha `OPENAI_API_KEY`.
3. Opcionalmente preencha `OPENAI_MODEL`.
4. Rode `npm run server:dev`.
5. No frontend, mantenha `VITE_AI_BACKEND_URL=http://localhost:8787`.

As chaves reais ficam no backend. Nunca coloque `service_role` ou chave OpenAI no frontend.

## Usar sem IA real

Se `OPENAI_API_KEY` não existir, o backend retorna mocks controlados. Se o backend não estiver rodando, o frontend também usa mocks locais.

## Teste manual sugerido

1. Abrir o app.
2. Entrar na página de evolução.
3. Importar laboratório por texto.
4. Gerar evolução.
5. Entrar na página Round.
6. Clicar em `IMPORTAR EVOLUÇÕES DE ONTEM`.
7. Processar evoluções.
8. Usar pacientes para gerar mapa.
9. Abrir `MAPA ROUND`, copiar e imprimir.
10. Abrir `BRIEFING` e copiar o texto.

## Comandos úteis

```bash
npm run build
npm run typecheck
npm run lint
```

## Aviso médico

Este app não substitui julgamento médico. Sugestões são apoio à decisão e devem ser revisadas pelo médico responsável.

## Desenvolvimento e testes

```bash
npm install
cp .env.example .env            # preencha OPENAI_API_KEY, VITE_SUPABASE_*, SUPABASE_*
npm run dev:all                 # Vite (5173, com proxy) + Express (8787)

npm run typecheck               # frontend, servidor e testes
npm test                        # Vitest: rotas do servidor, guardrails, schemas, documentos
npm run test:e2e                # Playwright (modo local sem login; AI_MOCK=1 no backend)
E2E_SUPABASE_URL=... E2E_SUPABASE_ANON_KEY=... E2E_SUPABASE_SERVICE_ROLE_KEY=... npm run test:e2e   # com auth real (supabase start)

npm run build && npm run build:server && npm start   # produção (Dockerfile.railway faz o mesmo)
```

Banco: aplique `supabase/migrations/20260915000000_canonical_schema.sql` em um projeto limpo (`supabase db reset` local ou `supabase db push`).
Variáveis novas no Railway: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGINS`. Na Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
