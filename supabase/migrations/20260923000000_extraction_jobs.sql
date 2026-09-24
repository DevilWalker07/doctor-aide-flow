-- extraction_jobs: a tabela onde o backend guarda o estado dos jobs longos.
--
-- Por que esta migration existe separada da canônica:
--
-- O banco de produção é de outra geração do projeto — `shifts` tem
-- `shift_date/unit/ward` onde o código espera `date/sector/type`, `patients`
-- guarda tudo num `data_json`. A canônica (20260915000000) nunca foi aplicada
-- lá, e aplicá-la agora não consertaria isso: `create table if not exists`
-- ignora em silêncio a tabela divergente que já existe. Pior, o
-- `revoke all on all tables in schema public from anon` dela atinge tabelas
-- que não são deste projeto (ai_events, documents, lab_exams).
--
-- Então esta migration faz UMA coisa: cria a tabela que o servidor precisa
-- para o fluxo assíncrono existir. Sem ela, `jobStore.create` lança e a
-- passagem de plantão morre antes de ler o primeiro arquivo — que é
-- exatamente o que vinha acontecendo em produção.
--
-- O conteúdo é recortado de 20260915000000_canonical_schema.sql, sem
-- alteração: quando a canônica for aplicada num banco novo, o
-- `if not exists` a torna inofensiva aqui.

create extension if not exists pgcrypto;

-- Escrita exclusiva do backend (service_role); user_id nullable para jobs anônimos.
create table if not exists public.extraction_jobs (
  id          uuid primary key default gen_random_uuid(),
  job_id      text not null unique,
  user_id     uuid references auth.users(id) on delete cascade,
  status      text not null default 'queued' check (status in ('queued', 'processing', 'done', 'error')),
  stage       text not null default 'Arquivo recebido',
  file_name   text,
  result      jsonb,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- O cliente consulta o job pelo job_id a cada poucos segundos.
create index if not exists extraction_jobs_job_id_idx on public.extraction_jobs (job_id);
create index if not exists extraction_jobs_user_created_idx on public.extraction_jobs (user_id, created_at desc);

-- Leitura pelo dono; escrita apenas pelo backend com service_role (ignora RLS).
-- Sem login o job nasce com user_id nulo: quem grava e quem lê é o servidor,
-- e o cliente chega até ele pelo job_id, que é um uuid não adivinhável.
alter table public.extraction_jobs enable row level security;
drop policy if exists own_jobs_select on public.extraction_jobs;
create policy own_jobs_select on public.extraction_jobs
  for select to authenticated using ((select auth.uid()) = user_id);
