-- Criação das tabelas para o DOUTOR AJUDA
-- Simplificado para o MVP (sem RLS complexo ou múltiplos usuários mandatórios)

CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  date DATE NOT NULL,
  sector TEXT NOT NULL,
  workplace TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own shifts" ON shifts FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  shift_id UUID REFERENCES shifts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  sex TEXT NOT NULL,
  bed TEXT NOT NULL,
  ward TEXT,
  unit TEXT,
  admission_date DATE,
  allergy TEXT,
  diagnoses_json JSONB,
  hda TEXT,
  antecedentes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own patients" ON patients FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS antibiotics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dose TEXT,
  route TEXT,
  frequency TEXT,
  start_date DATE NOT NULL,
  d0_or_d1 TEXT,
  planned_duration_days INTEGER,
  active BOOLEAN DEFAULT true,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lab_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  exam_date DATE,
  source TEXT,
  hb NUMERIC,
  ht NUMERIC,
  leukocytes NUMERIC,
  segmented_percent NUMERIC,
  bands_percent NUMERIC,
  platelets NUMERIC,
  creatinine NUMERIC,
  urea NUMERIC,
  sodium NUMERIC,
  potassium NUMERIC,
  crp NUMERIC,
  eas_piocitos NUMERIC,
  eas_nitrite TEXT,
  formatted_text TEXT,
  eas_formatted TEXT,
  alerts_json JSONB,
  raw_ai_response_json JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  evolution_text TEXT NOT NULL,
  generated_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE evolutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own evolutions" ON evolutions FOR ALL USING (auth.uid() = user_id);
