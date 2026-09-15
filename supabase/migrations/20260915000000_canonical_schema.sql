-- ============================================================
-- DOUTOR AJUDA — SCHEMA CANÔNICO
-- Substitui 00000_initial, 0001_doutor_ajuda, 20260514_fase3 e
-- 99999_local_mode (que desligava RLS). Aplicar em banco limpo:
--   supabase db reset            (local)
--   supabase db push             (projeto remoto)
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- FUNÇÕES AUXILIARES
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- TABELAS
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  name        text,
  crm         text,
  specialty   text,
  hospital    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.user_settings (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  evolution_template text,
  atb_day_rule       text not null default 'D0',
  atb_alert_days     integer not null default 7,
  default_hospital   text,
  default_sector     text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.shifts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date        date not null,
  hospital    text,
  sector      text,
  type        text,
  status      text not null default 'active' check (status in ('active', 'closed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.patients (
  id                   uuid primary key default gen_random_uuid(),
  shift_id             uuid references public.shifts(id) on delete cascade,
  user_id              uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name                 text,
  age                  text,
  sex                  text,
  bed                  text,
  sector               text,
  admission_date       date,
  reason_for_admission text,
  hda                  text,
  comorbidities        jsonb not null default '[]'::jsonb,
  problem_list         jsonb not null default '[]'::jsonb,
  antibiotics          jsonb not null default '[]'::jsonb,
  medications          jsonb not null default '[]'::jsonb,
  labs                 jsonb not null default '[]'::jsonb,
  physical_exam        jsonb not null default '{}'::jsonb,
  conducts             jsonb not null default '[]'::jsonb,
  pending_issues       jsonb not null default '[]'::jsonb,
  status               text not null default 'active',
  tipo_admissao        text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists public.clinical_documents (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid references public.patients(id) on delete cascade,
  shift_id      uuid references public.shifts(id) on delete set null,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  file_name     text,
  file_type     text,
  storage_path  text,
  uploaded_at   timestamptz not null default now()
);

create table if not exists public.clinical_extractions (
  id             uuid primary key default gen_random_uuid(),
  document_id    uuid references public.clinical_documents(id) on delete set null,
  patient_id     uuid references public.patients(id) on delete cascade,
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  engine         text,
  status         text,
  extracted_json jsonb,
  created_at     timestamptz not null default now()
);

-- Escrita exclusiva do backend (service_role); user_id nullable para jobs anônimos em dev.
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

create table if not exists public.evolutions (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid references public.patients(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  shift_id    uuid references public.shifts(id) on delete set null,
  content     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.prescriptions (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid references public.patients(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  shift_id    uuid references public.shifts(id) on delete set null,
  content     jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.handoffs (
  id          uuid primary key default gen_random_uuid(),
  shift_id    uuid references public.shifts(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content     text,
  created_at  timestamptz not null default now()
);

create table if not exists public.referrals (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid references public.patients(id) on delete cascade,
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  destinations jsonb not null default '[]'::jsonb,
  specialty    text,
  reason       text,
  content      text,
  created_at   timestamptz not null default now()
);

-- Receita de alta, encaminhamento e orientações (modo avulso: patient_id nulo)
create table if not exists public.outpatient_documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id  uuid references public.patients(id) on delete set null,
  type        text not null check (type in ('receita', 'encaminhamento', 'orientacoes')),
  title       text not null,
  content     jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- ÍNDICES (derivados dos padrões de consulta em src/lib/db.ts)
-- ------------------------------------------------------------
create index if not exists idx_shifts_user_status_created      on public.shifts (user_id, status, created_at desc);
create index if not exists idx_shifts_user_status_date         on public.shifts (user_id, status, date desc);
create index if not exists idx_patients_shift_user_bed         on public.patients (shift_id, user_id, bed);
create index if not exists idx_patients_user                   on public.patients (user_id);
create index if not exists idx_clinical_documents_patient_user on public.clinical_documents (patient_id, user_id);
create index if not exists idx_clinical_extractions_pat_user   on public.clinical_extractions (patient_id, user_id);
create index if not exists idx_extraction_jobs_user_created    on public.extraction_jobs (user_id, created_at desc);
create index if not exists idx_extraction_jobs_created         on public.extraction_jobs (created_at);
create index if not exists idx_evolutions_patient_user_created on public.evolutions (patient_id, user_id, created_at desc);
create index if not exists idx_prescriptions_pat_user_created  on public.prescriptions (patient_id, user_id, created_at desc);
create index if not exists idx_handoffs_shift_user_created     on public.handoffs (shift_id, user_id, created_at desc);
create index if not exists idx_referrals_patient_user          on public.referrals (patient_id, user_id);
create index if not exists idx_outpatient_docs_pat_user_created on public.outpatient_documents (patient_id, user_id, created_at desc);
create index if not exists idx_outpatient_docs_user_type       on public.outpatient_documents (user_id, type);

-- ------------------------------------------------------------
-- TRIGGERS updated_at
-- ------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['profiles','user_settings','shifts','patients','extraction_jobs','evolutions','prescriptions','outpatient_documents']
  loop
    execute format('drop trigger if exists trg_%s_updated on public.%I', t, t);
    execute format('create trigger trg_%s_updated before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end
$$;

-- ------------------------------------------------------------
-- PERFIL AUTOMÁTICO AO CRIAR USUÁRIO (auth.users → profiles + user_settings)
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict (user_id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY — isolamento por usuário autenticado
-- ------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','user_settings','shifts','patients','clinical_documents','clinical_extractions',
    'evolutions','prescriptions','handoffs','referrals','outpatient_documents'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists own_data on public.%I', t);
    execute format(
      'create policy own_data on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t
    );
  end loop;
end
$$;

-- extraction_jobs: leitura pelo dono; escrita apenas pelo backend com service_role (ignora RLS).
alter table public.extraction_jobs enable row level security;
drop policy if exists own_jobs_select on public.extraction_jobs;
create policy own_jobs_select on public.extraction_jobs
  for select to authenticated using ((select auth.uid()) = user_id);

-- Nenhum acesso para anon em nenhuma tabela (padrão: sem policy = negado).
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
