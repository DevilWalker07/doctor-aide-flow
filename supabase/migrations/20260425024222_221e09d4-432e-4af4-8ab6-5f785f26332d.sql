-- Tabela de plantões
CREATE TABLE public.shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  sector TEXT,
  workplace TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

-- Tabela de pacientes
CREATE TABLE public.patients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  age INTEGER,
  sex TEXT,
  bed TEXT,
  ward TEXT,
  unit TEXT,
  admission_date DATE,
  allergy TEXT,
  diagnoses_json JSONB DEFAULT '[]'::jsonb,
  hda TEXT,
  antecedentes TEXT,
  data_json JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'PENDENTE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de antibióticos
CREATE TABLE public.antibiotics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dose TEXT,
  route TEXT,
  frequency TEXT,
  start_date DATE,
  d0_or_d1 TEXT DEFAULT 'D0',
  planned_duration_days INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de exames laboratoriais
CREATE TABLE public.lab_exams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  exam_date DATE,
  source TEXT DEFAULT 'TEXTO',
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
  eas_piocitos TEXT,
  eas_nitrite TEXT,
  formatted_text TEXT,
  eas_formatted TEXT,
  alerts_json JSONB DEFAULT '[]'::jsonb,
  raw_ai_response_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de evoluções
CREATE TABLE public.evolutions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
  evolution_text TEXT NOT NULL,
  generated_by TEXT DEFAULT 'AI',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_patients_updated BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_evolutions_updated BEFORE UPDATE ON public.evolutions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Habilita RLS
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.antibiotics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evolutions ENABLE ROW LEVEL SECURITY;

-- Políticas abertas (MVP sem auth, uso pessoal)
CREATE POLICY "open_all_shifts" ON public.shifts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all_patients" ON public.patients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all_antibiotics" ON public.antibiotics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all_lab_exams" ON public.lab_exams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all_evolutions" ON public.evolutions FOR ALL USING (true) WITH CHECK (true);

-- Índices úteis
CREATE INDEX idx_patients_shift ON public.patients(shift_id);
CREATE INDEX idx_antibiotics_patient ON public.antibiotics(patient_id);
CREATE INDEX idx_lab_patient_date ON public.lab_exams(patient_id, exam_date DESC);
CREATE INDEX idx_evolutions_patient ON public.evolutions(patient_id, created_at DESC);