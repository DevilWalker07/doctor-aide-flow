-- ============================================
-- DOUTOR AJUDA — FASE 3: SCHEMA COMPLETO
-- Executar no SQL Editor do Supabase
-- ============================================

-- ============================================
-- EXTENSÕES
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  name        text,
  crm         text,
  specialty   text,
  hospital    text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ============================================
-- CONFIGURAÇÕES DO USUÁRIO
-- ============================================
CREATE TABLE IF NOT EXISTS user_settings (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  evolution_template text,
  atb_day_rule      text DEFAULT 'D0',
  atb_alert_days    integer DEFAULT 7,
  default_hospital  text,
  default_sector    text,
  updated_at        timestamptz DEFAULT now()
);

-- ============================================
-- PLANTÕES
-- ============================================
CREATE TABLE IF NOT EXISTS shifts (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  date        date NOT NULL,
  hospital    text,
  sector      text,
  type        text,
  status      text DEFAULT 'active',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ============================================
-- PACIENTES
-- ============================================
CREATE TABLE IF NOT EXISTS patients (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id             uuid REFERENCES shifts(id) ON DELETE CASCADE,
  user_id              uuid REFERENCES auth.users(id),
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
-- DOCUMENTOS CLÍNICOS
-- ============================================
CREATE TABLE IF NOT EXISTS clinical_documents (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id    uuid REFERENCES patients(id) ON DELETE CASCADE,
  shift_id      uuid REFERENCES shifts(id),
  user_id       uuid REFERENCES auth.users(id),
  file_name     text,
  file_type     text,
  storage_path  text,
  uploaded_at   timestamptz DEFAULT now()
);

-- ============================================
-- EXTRAÇÕES DA IA
-- ============================================
CREATE TABLE IF NOT EXISTS clinical_extractions (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id    uuid REFERENCES clinical_documents(id),
  patient_id     uuid REFERENCES patients(id),
  user_id        uuid REFERENCES auth.users(id),
  engine         text,
  status         text,
  extracted_json jsonb,
  created_at     timestamptz DEFAULT now()
);

-- ============================================
-- JOBS DE EXTRAÇÃO ASSÍNCRONA
-- ============================================
CREATE TABLE IF NOT EXISTS extraction_jobs (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id      text UNIQUE NOT NULL,
  user_id     uuid REFERENCES auth.users(id),
  status      text DEFAULT 'queued',
  stage       text DEFAULT 'Arquivo recebido',
  file_name   text,
  result      jsonb,
  error       text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ============================================
-- EVOLUÇÕES MÉDICAS
-- ============================================
CREATE TABLE IF NOT EXISTS evolutions (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id  uuid REFERENCES patients(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id),
  shift_id    uuid REFERENCES shifts(id),
  content     text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ============================================
-- PRESCRIÇÕES
-- ============================================
CREATE TABLE IF NOT EXISTS prescriptions (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id  uuid REFERENCES patients(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id),
  shift_id    uuid REFERENCES shifts(id),
  content     jsonb,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ============================================
-- PASSAGENS DE PLANTÃO
-- ============================================
CREATE TABLE IF NOT EXISTS handoffs (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  shift_id    uuid REFERENCES shifts(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id),
  content     text,
  created_at  timestamptz DEFAULT now()
);

-- ============================================
-- ENCAMINHAMENTOS
-- ============================================
CREATE TABLE IF NOT EXISTS referrals (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id   uuid REFERENCES patients(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES auth.users(id),
  destinations jsonb DEFAULT '[]',
  specialty    text,
  reason       text,
  content      text,
  created_at   timestamptz DEFAULT now()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients             ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_documents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_jobs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE evolutions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE handoffs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals            ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLICIES — usuário só vê seus próprios dados
-- ============================================
CREATE POLICY "own_data" ON profiles
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON user_settings
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON shifts
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON patients
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON clinical_documents
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON clinical_extractions
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON extraction_jobs
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON evolutions
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON prescriptions
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON handoffs
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_data" ON referrals
  FOR ALL USING (auth.uid() = user_id);

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

CREATE TRIGGER trg_shifts_updated
  BEFORE UPDATE ON shifts FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_patients_updated
  BEFORE UPDATE ON patients FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_evolutions_updated
  BEFORE UPDATE ON evolutions FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_prescriptions_updated
  BEFORE UPDATE ON prescriptions FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_extraction_jobs_updated
  BEFORE UPDATE ON extraction_jobs FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
