-- ============================================
-- DOUTOR AJUDA — SCHEMA MODO LOCAL (sem auth)
-- Cole no SQL Editor do Supabase e clique RUN
-- ============================================

-- EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     text UNIQUE,
  name        text,
  crm         text,
  specialty   text,
  hospital    text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ============================================
-- USER SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS user_settings (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            text UNIQUE,
  evolution_template text,
  atb_day_rule       text DEFAULT 'D0',
  atb_alert_days     integer DEFAULT 7,
  default_hospital   text,
  default_sector     text,
  updated_at         timestamptz DEFAULT now()
);

-- ============================================
-- SHIFTS
-- ============================================
CREATE TABLE IF NOT EXISTS shifts (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     text,
  date        date NOT NULL,
  hospital    text,
  sector      text,
  type        text,
  status      text DEFAULT 'active',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ============================================
-- PATIENTS
-- ============================================
CREATE TABLE IF NOT EXISTS patients (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id             uuid REFERENCES shifts(id) ON DELETE CASCADE,
  user_id              text,
  name                 text,
  age                  text,
  sex                  text,
  bed                  text,
  sector               text,
  admission_date       date,
  reason_for_admission text,
  hda                  text,
  comorbidities        jsonb DEFAULT '[]',
  problem_list         jsonb DEFAULT '[]',
  antibiotics          jsonb DEFAULT '[]',
  medications          jsonb DEFAULT '[]',
  labs                 jsonb DEFAULT '[]',
  physical_exam        jsonb DEFAULT '{}',
  conducts             jsonb DEFAULT '[]',
  pending_issues       jsonb DEFAULT '[]',
  status               text DEFAULT 'active',
  tipo_admissao        text,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- ============================================
-- CLINICAL DOCUMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS clinical_documents (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id   uuid REFERENCES patients(id) ON DELETE CASCADE,
  shift_id     uuid REFERENCES shifts(id),
  user_id      text,
  file_name    text,
  file_type    text,
  storage_path text,
  uploaded_at  timestamptz DEFAULT now()
);

-- ============================================
-- CLINICAL EXTRACTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS clinical_extractions (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id    uuid REFERENCES clinical_documents(id),
  patient_id     uuid REFERENCES patients(id),
  user_id        text,
  engine         text,
  status         text,
  extracted_json jsonb,
  created_at     timestamptz DEFAULT now()
);

-- ============================================
-- EXTRACTION JOBS
-- ============================================
CREATE TABLE IF NOT EXISTS extraction_jobs (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id      text UNIQUE NOT NULL,
  user_id     text,
  status      text DEFAULT 'queued',
  stage       text DEFAULT 'Arquivo recebido',
  file_name   text,
  result      jsonb,
  error       text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ============================================
-- EVOLUTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS evolutions (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id  uuid REFERENCES patients(id) ON DELETE CASCADE,
  user_id     text,
  shift_id    uuid REFERENCES shifts(id),
  content     text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ============================================
-- PRESCRIPTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS prescriptions (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id  uuid REFERENCES patients(id) ON DELETE CASCADE,
  user_id     text,
  shift_id    uuid REFERENCES shifts(id),
  content     jsonb,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ============================================
-- HANDOFFS
-- ============================================
CREATE TABLE IF NOT EXISTS handoffs (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id   uuid REFERENCES shifts(id) ON DELETE CASCADE,
  user_id    text,
  content    text,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- REFERRALS
-- ============================================
CREATE TABLE IF NOT EXISTS referrals (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id   uuid REFERENCES patients(id) ON DELETE CASCADE,
  user_id      text,
  destinations jsonb DEFAULT '[]',
  specialty    text,
  reason       text,
  content      text,
  created_at   timestamptz DEFAULT now()
);

-- ============================================
-- RLS desabilitada (modo local, sem login)
-- Importante: como você é o único acessando com a anon key,
-- sua API anon key precisa estar protegida. Não compartilhe.
-- Quando adicionarmos login, ativamos RLS de novo.
-- ============================================
ALTER TABLE profiles             DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings        DISABLE ROW LEVEL SECURITY;
ALTER TABLE shifts               DISABLE ROW LEVEL SECURITY;
ALTER TABLE patients             DISABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_documents   DISABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_extractions DISABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_jobs      DISABLE ROW LEVEL SECURITY;
ALTER TABLE evolutions           DISABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions        DISABLE ROW LEVEL SECURITY;
ALTER TABLE handoffs             DISABLE ROW LEVEL SECURITY;
ALTER TABLE referrals            DISABLE ROW LEVEL SECURITY;

-- ============================================
-- TRIGGER: atualizar updated_at automaticamente
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_shifts_updated ON shifts;
CREATE TRIGGER trg_shifts_updated
  BEFORE UPDATE ON shifts FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_patients_updated ON patients;
CREATE TRIGGER trg_patients_updated
  BEFORE UPDATE ON patients FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_evolutions_updated ON evolutions;
CREATE TRIGGER trg_evolutions_updated
  BEFORE UPDATE ON evolutions FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_prescriptions_updated ON prescriptions;
CREATE TRIGGER trg_prescriptions_updated
  BEFORE UPDATE ON prescriptions FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_extraction_jobs_updated ON extraction_jobs;
CREATE TRIGGER trg_extraction_jobs_updated
  BEFORE UPDATE ON extraction_jobs FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
