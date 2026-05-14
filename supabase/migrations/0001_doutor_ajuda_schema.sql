-- DOUTOR AJUDA / HNAS ASSIST - MVP schema
-- ATENÇÃO: em produção médica real, configurar RLS por usuário e regras de segurança.
-- Para MVP local, as tabelas ficam sem RLS forçada para não quebrar o fallback.

create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  sector text,
  workplace text,
  active boolean default true,
  created_at timestamptz default now(),
  ended_at timestamptz
);

create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid references shifts(id) on delete set null,
  bed text,
  name text not null,
  age int,
  sex text,
  sector text,
  ward text,
  admission_date date,
  dih int,
  diagnoses jsonb default '[]',
  comorbidities jsonb default '[]',
  devices jsonb default '[]',
  current_status text,
  pending_issues jsonb default '[]',
  alerts jsonb default '[]',
  tags jsonb default '[]',
  memory jsonb default '[]',
  data jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists antibiotics (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id) on delete cascade,
  name text,
  dose text,
  route text,
  frequency text,
  start_date date,
  d0_or_d1 text,
  planned_duration_days int,
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists lab_exams (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id) on delete cascade,
  exam_date date,
  source text,
  hb numeric,
  ht numeric,
  leukocytes numeric,
  segmented_percent numeric,
  bands_percent numeric,
  platelets numeric,
  creatinine numeric,
  urea numeric,
  sodium numeric,
  potassium numeric,
  crp numeric,
  eas_piocitos numeric,
  eas_nitrite text,
  formatted_text text,
  eas_formatted text,
  alerts jsonb default '[]',
  raw_ai_response jsonb,
  created_at timestamptz default now()
);

create table if not exists evolutions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id) on delete cascade,
  shift_id uuid references shifts(id) on delete set null,
  date date,
  evolution_text text,
  generated_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists round_maps (
  id uuid primary key default gen_random_uuid(),
  date date,
  sector text,
  map_text text,
  patients jsonb default '[]',
  alerts jsonb default '[]',
  created_at timestamptz default now()
);

create table if not exists imported_yesterday_evolutions (
  id uuid primary key default gen_random_uuid(),
  date date,
  raw_text text,
  extracted_patients jsonb default '[]',
  created_at timestamptz default now()
);

create table if not exists ai_logs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references patients(id) on delete set null,
  function_name text,
  input_type text,
  success boolean,
  error_message text,
  created_at timestamptz default now()
);
