export type Horario = "manha" | "almoco" | "tarde" | "noite" | "ao_deitar";
export type Acao = "comprimido" | "gotas" | "injecao" | "inalacao" | "topico" | "oftalmico";
export type Especialidade =
  | "Cardiologia/Nefrologia"
  | "Endocrinologia"
  | "Infectologia/Pneumologia"
  | "Gastroenterologia"
  | "Neurologia"
  | "Psiquiatria"
  | "Analgesia/Geral";

export type Controlado = "C1" | "B1" | null;

export interface Preset {
  id: string;
  label: string;
  dose: string;
  quantidade: string;
  horarios: Partial<Record<Horario, number>>;
  instrucao: string;
  duracao?: string;
  observacao?: string;
}

export interface Medicamento {
  id: string;
  nome: string;
  apresentacao: string;
  classe: string;
  especialidade: Especialidade;
  acao: Acao;
  farmaciaPopular: boolean;
  controlado?: Controlado;
  presets: Preset[];
  alertas?: string[];
}

export const HORARIOS: { id: Horario; label: string; curto: string; emoji: string }[] = [
  { id: "manha", label: "Manhã", curto: "MANHÃ", emoji: "🌅" },
  { id: "almoco", label: "Almoço", curto: "ALMOÇO", emoji: "☀️" },
  { id: "tarde", label: "Tarde", curto: "TARDE", emoji: "🌇" },
  { id: "noite", label: "Noite", curto: "NOITE", emoji: "🌙" },
  { id: "ao_deitar", label: "Ao deitar", curto: "DEITAR", emoji: "🛏️" },
];

export const ESPECIALIDADES: Especialidade[] = [
  "Cardiologia/Nefrologia",
  "Endocrinologia",
  "Infectologia/Pneumologia",
  "Gastroenterologia",
  "Neurologia",
  "Psiquiatria",
  "Analgesia/Geral",
];

// Lista do Programa Farmácia Popular sujeita a atualização — conferir vigência antes de orientar o paciente.
export const FARMACIA_POPULAR_VERSAO = "2025";

const cp = (n: number) => `${n} comprimidos`;

function p(
  id: string,
  label: string,
  dose: string,
  quantidade: string,
  horarios: Partial<Record<Horario, number>>,
  instrucao: string,
  duracao = "Uso contínuo",
  observacao?: string,
): Preset {
  return { id, label, dose, quantidade, horarios, instrucao, duracao, observacao };
}

export const MEDICAMENTOS: Medicamento[] = [
  // ── Cardiologia / Nefrologia ─────────────────────────────────────────────
  {
    id: "espironolactona-25",
    nome: "Espironolactona",
    apresentacao: "25 mg comprimido",
    classe: "Diurético",
    especialidade: "Cardiologia/Nefrologia",
    acao: "comprimido",
    farmaciaPopular: true,
    presets: [
      p(
        "1x-manha",
        "25 mg pela manhã",
        "25 mg",
        cp(30),
        { manha: 1 },
        "Tomar 1 comprimido pela manhã, todos os dias.",
      ),
      p(
        "2x-manha",
        "50 mg pela manhã",
        "50 mg",
        cp(60),
        { manha: 2 },
        "Tomar 2 comprimidos pela manhã, todos os dias.",
      ),
    ],
    alertas: ["Controlar potássio e creatinina."],
  },
  {
    id: "furosemida-40",
    nome: "Furosemida",
    apresentacao: "40 mg comprimido",
    classe: "Diurético",
    especialidade: "Cardiologia/Nefrologia",
    acao: "comprimido",
    farmaciaPopular: true,
    presets: [
      p(
        "1x-manha",
        "40 mg pela manhã",
        "40 mg",
        cp(30),
        { manha: 1 },
        "Tomar 1 comprimido pela manhã, em jejum.",
      ),
      p(
        "2x",
        "40 mg manhã e almoço",
        "40 mg",
        cp(60),
        { manha: 1, almoco: 1 },
        "Tomar 1 comprimido pela manhã e 1 no almoço.",
      ),
    ],
  },
  {
    id: "hidroclorotiazida-25",
    nome: "Hidroclorotiazida",
    apresentacao: "25 mg comprimido",
    classe: "Diurético",
    especialidade: "Cardiologia/Nefrologia",
    acao: "comprimido",
    farmaciaPopular: true,
    presets: [
      p(
        "1x-manha",
        "25 mg pela manhã",
        "25 mg",
        cp(30),
        { manha: 1 },
        "Tomar 1 comprimido pela manhã, todos os dias.",
      ),
    ],
  },
  {
    id: "losartana-50",
    nome: "Losartana",
    apresentacao: "50 mg comprimido",
    classe: "Anti-hipertensivo",
    especialidade: "Cardiologia/Nefrologia",
    acao: "comprimido",
    farmaciaPopular: true,
    presets: [
      p(
        "1x-manha",
        "50 mg pela manhã",
        "50 mg",
        cp(30),
        { manha: 1 },
        "Tomar 1 comprimido pela manhã, todos os dias.",
      ),
      p(
        "2x",
        "50 mg de 12 em 12 horas",
        "50 mg",
        cp(60),
        { manha: 1, noite: 1 },
        "Tomar 1 comprimido pela manhã e 1 à noite.",
      ),
    ],
  },
  {
    id: "enalapril-10",
    nome: "Enalapril",
    apresentacao: "10 mg comprimido",
    classe: "Anti-hipertensivo",
    especialidade: "Cardiologia/Nefrologia",
    acao: "comprimido",
    farmaciaPopular: true,
    presets: [
      p(
        "2x",
        "10 mg de 12 em 12 horas",
        "10 mg",
        cp(60),
        { manha: 1, noite: 1 },
        "Tomar 1 comprimido pela manhã e 1 à noite.",
      ),
    ],
  },
  {
    id: "captopril-25",
    nome: "Captopril",
    apresentacao: "25 mg comprimido",
    classe: "Anti-hipertensivo",
    especialidade: "Cardiologia/Nefrologia",
    acao: "comprimido",
    farmaciaPopular: true,
    presets: [
      p(
        "3x",
        "25 mg de 8 em 8 horas",
        "25 mg",
        cp(90),
        { manha: 1, tarde: 1, noite: 1 },
        "Tomar 1 comprimido pela manhã, 1 à tarde e 1 à noite, longe das refeições.",
      ),
    ],
  },
  {
    id: "anlodipino-5",
    nome: "Anlodipino",
    apresentacao: "5 mg comprimido",
    classe: "Anti-hipertensivo",
    especialidade: "Cardiologia/Nefrologia",
    acao: "comprimido",
    farmaciaPopular: true,
    presets: [
      p(
        "1x-manha",
        "5 mg pela manhã",
        "5 mg",
        cp(30),
        { manha: 1 },
        "Tomar 1 comprimido pela manhã, todos os dias.",
      ),
      p(
        "2x-manha",
        "10 mg pela manhã",
        "10 mg",
        cp(60),
        { manha: 2 },
        "Tomar 2 comprimidos pela manhã, todos os dias.",
      ),
    ],
  },
  {
    id: "atenolol-50",
    nome: "Atenolol",
    apresentacao: "50 mg comprimido",
    classe: "Betabloqueador",
    especialidade: "Cardiologia/Nefrologia",
    acao: "comprimido",
    farmaciaPopular: true,
    presets: [
      p(
        "1x-manha",
        "50 mg pela manhã",
        "50 mg",
        cp(30),
        { manha: 1 },
        "Tomar 1 comprimido pela manhã, todos os dias.",
      ),
    ],
  },
  {
    id: "carvedilol-6",
    nome: "Carvedilol",
    apresentacao: "6,25 mg comprimido",
    classe: "Betabloqueador",
    especialidade: "Cardiologia/Nefrologia",
    acao: "comprimido",
    farmaciaPopular: false,
    presets: [
      p(
        "2x",
        "6,25 mg de 12 em 12 horas",
        "6,25 mg",
        cp(60),
        { manha: 1, noite: 1 },
        "Tomar 1 comprimido pela manhã e 1 à noite, junto com alimentos.",
      ),
    ],
  },
  {
    id: "propranolol-40",
    nome: "Propranolol",
    apresentacao: "40 mg comprimido",
    classe: "Betabloqueador",
    especialidade: "Cardiologia/Nefrologia",
    acao: "comprimido",
    farmaciaPopular: true,
    presets: [
      p(
        "2x",
        "40 mg de 12 em 12 horas",
        "40 mg",
        cp(60),
        { manha: 1, noite: 1 },
        "Tomar 1 comprimido pela manhã e 1 à noite.",
      ),
    ],
  },
  {
    id: "aas-100",
    nome: "Ácido acetilsalicílico (AAS)",
    apresentacao: "100 mg comprimido",
    classe: "Antiagregante",
    especialidade: "Cardiologia/Nefrologia",
    acao: "comprimido",
    farmaciaPopular: false,
    presets: [
      p(
        "1x-almoco",
        "100 mg após o almoço",
        "100 mg",
        cp(30),
        { almoco: 1 },
        "Tomar 1 comprimido após o almoço, todos os dias.",
      ),
    ],
  },
  {
    id: "varfarina-5",
    nome: "Varfarina",
    apresentacao: "5 mg comprimido",
    classe: "Anticoagulante",
    especialidade: "Cardiologia/Nefrologia",
    acao: "comprimido",
    farmaciaPopular: false,
    presets: [
      p(
        "1x-noite",
        "5 mg à noite",
        "5 mg",
        cp(30),
        { noite: 1 },
        "Tomar 1 comprimido à noite, sempre no mesmo horário.",
        "Uso contínuo",
        "Controlar INR conforme orientação.",
      ),
    ],
    alertas: ["Ajustar dose pelo INR.", "Evitar AINEs."],
  },
  {
    id: "rivaroxabana-20",
    nome: "Rivaroxabana",
    apresentacao: "20 mg comprimido",
    classe: "Anticoagulante",
    especialidade: "Cardiologia/Nefrologia",
    acao: "comprimido",
    farmaciaPopular: false,
    presets: [
      p(
        "1x-almoco",
        "20 mg no almoço",
        "20 mg",
        cp(30),
        { almoco: 1 },
        "Tomar 1 comprimido junto com o almoço, todos os dias.",
      ),
    ],
  },
  {
    id: "apixabana-5",
    nome: "Apixabana",
    apresentacao: "5 mg comprimido",
    classe: "Anticoagulante",
    especialidade: "Cardiologia/Nefrologia",
    acao: "comprimido",
    farmaciaPopular: false,
    presets: [
      p(
        "2x",
        "5 mg de 12 em 12 horas",
        "5 mg",
        cp(60),
        { manha: 1, noite: 1 },
        "Tomar 1 comprimido pela manhã e 1 à noite.",
      ),
    ],
  },
  {
    id: "sinvastatina-20",
    nome: "Sinvastatina",
    apresentacao: "20 mg comprimido",
    classe: "Estatina",
    especialidade: "Cardiologia/Nefrologia",
    acao: "comprimido",
    farmaciaPopular: true,
    presets: [
      p(
        "1x-noite",
        "20 mg à noite",
        "20 mg",
        cp(30),
        { noite: 1 },
        "Tomar 1 comprimido à noite, todos os dias.",
      ),
      p(
        "2x-noite",
        "40 mg à noite",
        "40 mg",
        cp(60),
        { noite: 2 },
        "Tomar 2 comprimidos à noite, todos os dias.",
      ),
    ],
  },
  {
    id: "atorvastatina-20",
    nome: "Atorvastatina",
    apresentacao: "20 mg comprimido",
    classe: "Estatina",
    especialidade: "Cardiologia/Nefrologia",
    acao: "comprimido",
    farmaciaPopular: true,
    presets: [
      p(
        "1x-noite",
        "20 mg à noite",
        "20 mg",
        cp(30),
        { noite: 1 },
        "Tomar 1 comprimido à noite, todos os dias.",
      ),
    ],
  },

  // ── Endocrinologia ───────────────────────────────────────────────────────
  {
    id: "metformina-500",
    nome: "Metformina",
    apresentacao: "500 mg comprimido",
    classe: "Hipoglicemiante oral",
    especialidade: "Endocrinologia",
    acao: "comprimido",
    farmaciaPopular: true,
    presets: [
      p(
        "2x",
        "500 mg no almoço e no jantar",
        "500 mg",
        cp(60),
        { almoco: 1, noite: 1 },
        "Tomar 1 comprimido no almoço e 1 no jantar, junto com a comida.",
      ),
      p(
        "3x",
        "500 mg nas 3 refeições",
        "500 mg",
        cp(90),
        { manha: 1, almoco: 1, noite: 1 },
        "Tomar 1 comprimido no café, 1 no almoço e 1 no jantar, junto com a comida.",
      ),
    ],
  },
  {
    id: "metformina-850",
    nome: "Metformina",
    apresentacao: "850 mg comprimido",
    classe: "Hipoglicemiante oral",
    especialidade: "Endocrinologia",
    acao: "comprimido",
    farmaciaPopular: true,
    presets: [
      p(
        "2x",
        "850 mg no almoço e no jantar",
        "850 mg",
        cp(60),
        { almoco: 1, noite: 1 },
        "Tomar 1 comprimido no almoço e 1 no jantar, junto com a comida.",
      ),
    ],
  },
  {
    id: "glibenclamida-5",
    nome: "Glibenclamida",
    apresentacao: "5 mg comprimido",
    classe: "Hipoglicemiante oral",
    especialidade: "Endocrinologia",
    acao: "comprimido",
    farmaciaPopular: true,
    presets: [
      p(
        "1x-manha",
        "5 mg antes do café",
        "5 mg",
        cp(30),
        { manha: 1 },
        "Tomar 1 comprimido 30 minutos antes do café da manhã.",
      ),
    ],
    alertas: ["Risco de hipoglicemia em idosos."],
  },
  {
    id: "gliclazida-60",
    nome: "Gliclazida MR",
    apresentacao: "60 mg comprimido",
    classe: "Hipoglicemiante oral",
    especialidade: "Endocrinologia",
    acao: "comprimido",
    farmaciaPopular: false,
    presets: [
      p(
        "1x-manha",
        "60 mg no café",
        "60 mg",
        cp(30),
        { manha: 1 },
        "Tomar 1 comprimido junto com o café da manhã.",
      ),
    ],
  },
  {
    id: "dapagliflozina-10",
    nome: "Dapagliflozina",
    apresentacao: "10 mg comprimido",
    classe: "Hipoglicemiante oral",
    especialidade: "Endocrinologia",
    acao: "comprimido",
    farmaciaPopular: true,
    presets: [
      p(
        "1x-manha",
        "10 mg pela manhã",
        "10 mg",
        cp(30),
        { manha: 1 },
        "Tomar 1 comprimido pela manhã, todos os dias.",
      ),
    ],
  },
  {
    id: "insulina-nph",
    nome: "Insulina NPH",
    apresentacao: "100 UI/mL frasco 10 mL ou caneta",
    classe: "Insulina",
    especialidade: "Endocrinologia",
    acao: "injecao",
    farmaciaPopular: true,
    presets: [
      p(
        "2x",
        "manhã e ao deitar (dose individual)",
        "__ UI",
        "1 frasco",
        { manha: 1, ao_deitar: 1 },
        "Aplicar __ unidades pela manhã e __ unidades ao deitar, na barriga ou na coxa, sob a pele.",
        "Uso contínuo",
        "Guardar na geladeira. Rodar os locais de aplicação.",
      ),
    ],
    alertas: ["Preencher as doses em UI."],
  },
  {
    id: "insulina-regular",
    nome: "Insulina Regular",
    apresentacao: "100 UI/mL frasco 10 mL",
    classe: "Insulina",
    especialidade: "Endocrinologia",
    acao: "injecao",
    farmaciaPopular: true,
    presets: [
      p(
        "3x",
        "antes das refeições (dose individual)",
        "__ UI",
        "1 frasco",
        { manha: 1, almoco: 1, noite: 1 },
        "Aplicar __ unidades 30 minutos antes do café, do almoço e do jantar.",
        "Uso contínuo",
      ),
    ],
  },
  {
    id: "levotiroxina-50",
    nome: "Levotiroxina",
    apresentacao: "50 mcg comprimido",
    classe: "Hormônio tireoidiano",
    especialidade: "Endocrinologia",
    acao: "comprimido",
    farmaciaPopular: false,
    presets: [
      p(
        "1x-jejum",
        "50 mcg em jejum",
        "50 mcg",
        cp(30),
        { manha: 1 },
        "Tomar 1 comprimido em jejum, 30 minutos antes do café, todos os dias.",
      ),
    ],
  },

  // ── Infectologia / Pneumologia ───────────────────────────────────────────
  {
    id: "amoxicilina-500",
    nome: "Amoxicilina",
    apresentacao: "500 mg cápsula",
    classe: "Antibiótico",
    especialidade: "Infectologia/Pneumologia",
    acao: "comprimido",
    farmaciaPopular: false,
    presets: [
      p(
        "3x-7d",
        "500 mg de 8 em 8 horas por 7 dias",
        "500 mg",
        "21 cápsulas",
        { manha: 1, tarde: 1, noite: 1 },
        "Tomar 1 cápsula pela manhã, 1 à tarde e 1 à noite, por 7 dias, sem parar.",
        "7 dias",
      ),
    ],
  },
  {
    id: "amoxicilina-clavulanato-875",
    nome: "Amoxicilina + Clavulanato",
    apresentacao: "875/125 mg comprimido",
    classe: "Antibiótico",
    especialidade: "Infectologia/Pneumologia",
    acao: "comprimido",
    farmaciaPopular: false,
    presets: [
      p(
        "2x-7d",
        "875 mg de 12 em 12 horas por 7 dias",
        "875/125 mg",
        cp(14),
        { manha: 1, noite: 1 },
        "Tomar 1 comprimido pela manhã e 1 à noite, junto com a comida, por 7 dias.",
        "7 dias",
      ),
    ],
  },
  {
    id: "azitromicina-500",
    nome: "Azitromicina",
    apresentacao: "500 mg comprimido",
    classe: "Antibiótico",
    especialidade: "Infectologia/Pneumologia",
    acao: "comprimido",
    farmaciaPopular: false,
    presets: [
      p(
        "1x-5d",
        "500 mg por 5 dias",
        "500 mg",
        cp(5),
        { manha: 1 },
        "Tomar 1 comprimido pela manhã, por 5 dias.",
        "5 dias",
      ),
      p(
        "1x-3d",
        "500 mg por 3 dias",
        "500 mg",
        cp(3),
        { manha: 1 },
        "Tomar 1 comprimido pela manhã, por 3 dias.",
        "3 dias",
      ),
    ],
  },
  {
    id: "cefalexina-500",
    nome: "Cefalexina",
    apresentacao: "500 mg cápsula",
    classe: "Antibiótico",
    especialidade: "Infectologia/Pneumologia",
    acao: "comprimido",
    farmaciaPopular: false,
    presets: [
      p(
        "4x-7d",
        "500 mg de 6 em 6 horas por 7 dias",
        "500 mg",
        "28 cápsulas",
        { manha: 1, almoco: 1, noite: 1, ao_deitar: 1 },
        "Tomar 1 cápsula de 6 em 6 horas (manhã, almoço, noite e ao deitar), por 7 dias.",
        "7 dias",
      ),
    ],
  },
  {
    id: "ciprofloxacino-500",
    nome: "Ciprofloxacino",
    apresentacao: "500 mg comprimido",
    classe: "Antibiótico",
    especialidade: "Infectologia/Pneumologia",
    acao: "comprimido",
    farmaciaPopular: false,
    presets: [
      p(
        "2x-7d",
        "500 mg de 12 em 12 horas por 7 dias",
        "500 mg",
        cp(14),
        { manha: 1, noite: 1 },
        "Tomar 1 comprimido pela manhã e 1 à noite, por 7 dias.",
        "7 dias",
      ),
    ],
    alertas: ["Ajustar em insuficiência renal."],
  },
  {
    id: "nitrofurantoina-100",
    nome: "Nitrofurantoína",
    apresentacao: "100 mg cápsula",
    classe: "Antibiótico",
    especialidade: "Infectologia/Pneumologia",
    acao: "comprimido",
    farmaciaPopular: false,
    presets: [
      p(
        "4x-5d",
        "100 mg de 6 em 6 horas por 5 dias",
        "100 mg",
        "20 cápsulas",
        { manha: 1, almoco: 1, noite: 1, ao_deitar: 1 },
        "Tomar 1 cápsula de 6 em 6 horas, junto com alimentos, por 5 dias.",
        "5 dias",
      ),
    ],
  },
  {
    id: "smx-tmp-800",
    nome: "Sulfametoxazol + Trimetoprima",
    apresentacao: "800/160 mg comprimido",
    classe: "Antibiótico",
    especialidade: "Infectologia/Pneumologia",
    acao: "comprimido",
    farmaciaPopular: false,
    presets: [
      p(
        "2x-7d",
        "800/160 mg de 12 em 12 horas por 7 dias",
        "800/160 mg",
        cp(14),
        { manha: 1, noite: 1 },
        "Tomar 1 comprimido pela manhã e 1 à noite, com bastante água, por 7 dias.",
        "7 dias",
      ),
    ],
  },
  {
    id: "salbutamol-spray",
    nome: "Salbutamol spray",
    apresentacao: "100 mcg/dose aerossol",
    classe: "Broncodilatador",
    especialidade: "Infectologia/Pneumologia",
    acao: "inalacao",
    farmaciaPopular: true,
    presets: [
      p(
        "sos",
        "2 jatos se falta de ar",
        "2 jatos",
        "1 frasco",
        {},
        "Fazer 2 jatos se tiver falta de ar ou chiado. Pode repetir a cada 4 horas se precisar.",
        "Se necessário",
        "Usar com espaçador.",
      ),
    ],
  },
  {
    id: "beclometasona-spray",
    nome: "Beclometasona spray",
    apresentacao: "250 mcg/dose aerossol",
    classe: "Corticoide inalatório",
    especialidade: "Infectologia/Pneumologia",
    acao: "inalacao",
    farmaciaPopular: true,
    presets: [
      p(
        "2x",
        "2 jatos de 12 em 12 horas",
        "2 jatos",
        "1 frasco",
        { manha: 1, noite: 1 },
        "Fazer 2 jatos pela manhã e 2 à noite, todos os dias. Enxaguar a boca depois.",
        "Uso contínuo",
      ),
    ],
  },
  {
    id: "budesonida-formoterol",
    nome: "Budesonida + Formoterol",
    apresentacao: "200/6 mcg pó inalatório",
    classe: "Corticoide + broncodilatador",
    especialidade: "Infectologia/Pneumologia",
    acao: "inalacao",
    farmaciaPopular: false,
    presets: [
      p(
        "2x",
        "1 inalação de 12 em 12 horas",
        "200/6 mcg",
        "1 dispositivo",
        { manha: 1, noite: 1 },
        "Fazer 1 inalação pela manhã e 1 à noite, todos os dias. Enxaguar a boca depois.",
        "Uso contínuo",
      ),
    ],
  },
  {
    id: "ipratropio-spray",
    nome: "Brometo de ipratrópio",
    apresentacao: "20 mcg/dose aerossol",
    classe: "Broncodilatador",
    especialidade: "Infectologia/Pneumologia",
    acao: "inalacao",
    farmaciaPopular: true,
    presets: [
      p(
        "4x",
        "2 jatos de 6 em 6 horas",
        "2 jatos",
        "1 frasco",
        { manha: 1, almoco: 1, noite: 1, ao_deitar: 1 },
        "Fazer 2 jatos de 6 em 6 horas.",
        "Uso contínuo",
      ),
    ],
  },

  // ── Gastroenterologia ────────────────────────────────────────────────────
  {
    id: "omeprazol-20",
    nome: "Omeprazol",
    apresentacao: "20 mg cápsula",
    classe: "Inibidor de bomba de prótons",
    especialidade: "Gastroenterologia",
    acao: "comprimido",
    farmaciaPopular: false,
    presets: [
      p(
        "1x-jejum",
        "20 mg em jejum",
        "20 mg",
        "30 cápsulas",
        { manha: 1 },
        "Tomar 1 cápsula em jejum, 30 minutos antes do café da manhã.",
        "30 dias",
      ),
    ],
  },
  {
    id: "pantoprazol-40",
    nome: "Pantoprazol",
    apresentacao: "40 mg comprimido",
    classe: "Inibidor de bomba de prótons",
    especialidade: "Gastroenterologia",
    acao: "comprimido",
    farmaciaPopular: false,
    presets: [
      p(
        "1x-jejum",
        "40 mg em jejum",
        "40 mg",
        cp(30),
        { manha: 1 },
        "Tomar 1 comprimido em jejum, 30 minutos antes do café da manhã.",
        "30 dias",
      ),
    ],
  },
  {
    id: "domperidona-10",
    nome: "Domperidona",
    apresentacao: "10 mg comprimido",
    classe: "Procinético",
    especialidade: "Gastroenterologia",
    acao: "comprimido",
    farmaciaPopular: false,
    presets: [
      p(
        "3x",
        "10 mg antes das refeições",
        "10 mg",
        cp(30),
        { manha: 1, almoco: 1, noite: 1 },
        "Tomar 1 comprimido 30 minutos antes do café, do almoço e do jantar.",
        "10 dias",
      ),
    ],
  },
  {
    id: "ondansetrona-8",
    nome: "Ondansetrona",
    apresentacao: "8 mg comprimido",
    classe: "Antiemético",
    especialidade: "Gastroenterologia",
    acao: "comprimido",
    farmaciaPopular: false,
    presets: [
      p(
        "sos",
        "8 mg se enjoo",
        "8 mg",
        cp(10),
        {},
        "Tomar 1 comprimido se tiver enjoo ou vômito. Pode repetir após 8 horas.",
        "Se necessário",
      ),
    ],
  },
  {
    id: "lactulose",
    nome: "Lactulose xarope",
    apresentacao: "667 mg/mL frasco 120 mL",
    classe: "Laxante",
    especialidade: "Gastroenterologia",
    acao: "gotas",
    farmaciaPopular: false,
    presets: [
      p(
        "1x-noite",
        "15 mL à noite",
        "15 mL",
        "1 frasco",
        { noite: 1 },
        "Tomar 15 mL (1 colher de sopa) à noite. Ajustar para evacuar 1 vez ao dia.",
        "Uso contínuo",
      ),
    ],
  },
  {
    id: "simeticona-40",
    nome: "Simeticona",
    apresentacao: "40 mg comprimido",
    classe: "Antiflatulento",
    especialidade: "Gastroenterologia",
    acao: "comprimido",
    farmaciaPopular: false,
    presets: [
      p(
        "3x",
        "40 mg após as refeições",
        "40 mg",
        cp(30),
        { manha: 1, almoco: 1, noite: 1 },
        "Tomar 1 comprimido após o café, o almoço e o jantar.",
        "Se necessário",
      ),
    ],
  },

  // ── Neurologia ───────────────────────────────────────────────────────────
  {
    id: "levodopa-carbidopa-250",
    nome: "Levodopa + Carbidopa",
    apresentacao: "250/25 mg comprimido",
    classe: "Antiparkinsoniano",
    especialidade: "Neurologia",
    acao: "comprimido",
    farmaciaPopular: true,
    presets: [
      p(
        "3x",
        "250/25 mg de 8 em 8 horas",
        "250/25 mg",
        cp(90),
        { manha: 1, tarde: 1, noite: 1 },
        "Tomar 1 comprimido pela manhã, 1 à tarde e 1 à noite, longe das refeições com proteína.",
        "Uso contínuo",
      ),
    ],
    alertas: ["Nunca suspender abruptamente."],
  },
  {
    id: "carbamazepina-200",
    nome: "Carbamazepina",
    apresentacao: "200 mg comprimido",
    classe: "Anticonvulsivante",
    especialidade: "Neurologia",
    acao: "comprimido",
    farmaciaPopular: false,
    controlado: "C1",
    presets: [
      p(
        "2x",
        "200 mg de 12 em 12 horas",
        "200 mg",
        cp(60),
        { manha: 1, noite: 1 },
        "Tomar 1 comprimido pela manhã e 1 à noite, todos os dias, sem interromper.",
        "Uso contínuo",
      ),
    ],
  },
  {
    id: "fenitoina-100",
    nome: "Fenitoína",
    apresentacao: "100 mg comprimido",
    classe: "Anticonvulsivante",
    especialidade: "Neurologia",
    acao: "comprimido",
    farmaciaPopular: false,
    controlado: "C1",
    presets: [
      p(
        "3x",
        "100 mg de 8 em 8 horas",
        "100 mg",
        cp(90),
        { manha: 1, tarde: 1, noite: 1 },
        "Tomar 1 comprimido pela manhã, 1 à tarde e 1 à noite, sem interromper.",
        "Uso contínuo",
      ),
    ],
  },

  // ── Psiquiatria ──────────────────────────────────────────────────────────
  {
    id: "sertralina-50",
    nome: "Sertralina",
    apresentacao: "50 mg comprimido",
    classe: "Antidepressivo",
    especialidade: "Psiquiatria",
    acao: "comprimido",
    farmaciaPopular: false,
    controlado: "C1",
    presets: [
      p(
        "1x-manha",
        "50 mg pela manhã",
        "50 mg",
        cp(30),
        { manha: 1 },
        "Tomar 1 comprimido pela manhã, todos os dias.",
        "Uso contínuo",
      ),
    ],
  },
  {
    id: "fluoxetina-20",
    nome: "Fluoxetina",
    apresentacao: "20 mg cápsula",
    classe: "Antidepressivo",
    especialidade: "Psiquiatria",
    acao: "comprimido",
    farmaciaPopular: false,
    controlado: "C1",
    presets: [
      p(
        "1x-manha",
        "20 mg pela manhã",
        "20 mg",
        "30 cápsulas",
        { manha: 1 },
        "Tomar 1 cápsula pela manhã, todos os dias.",
        "Uso contínuo",
      ),
    ],
  },
  {
    id: "amitriptilina-25",
    nome: "Amitriptilina",
    apresentacao: "25 mg comprimido",
    classe: "Antidepressivo tricíclico",
    especialidade: "Psiquiatria",
    acao: "comprimido",
    farmaciaPopular: false,
    controlado: "C1",
    presets: [
      p(
        "1x-deitar",
        "25 mg ao deitar",
        "25 mg",
        cp(30),
        { ao_deitar: 1 },
        "Tomar 1 comprimido ao deitar, todos os dias.",
        "Uso contínuo",
      ),
    ],
    alertas: ["Cautela em idosos (anticolinérgico)."],
  },
  {
    id: "risperidona-1",
    nome: "Risperidona",
    apresentacao: "1 mg comprimido",
    classe: "Antipsicótico",
    especialidade: "Psiquiatria",
    acao: "comprimido",
    farmaciaPopular: false,
    controlado: "C1",
    presets: [
      p(
        "1x-noite",
        "1 mg à noite",
        "1 mg",
        cp(30),
        { noite: 1 },
        "Tomar 1 comprimido à noite, todos os dias.",
        "Uso contínuo",
      ),
    ],
  },
  {
    id: "haloperidol-5",
    nome: "Haloperidol",
    apresentacao: "5 mg comprimido",
    classe: "Antipsicótico",
    especialidade: "Psiquiatria",
    acao: "comprimido",
    farmaciaPopular: false,
    controlado: "C1",
    presets: [
      p(
        "1x-noite",
        "5 mg à noite",
        "5 mg",
        cp(30),
        { noite: 1 },
        "Tomar 1 comprimido à noite, todos os dias.",
        "Uso contínuo",
      ),
    ],
  },
  {
    id: "clonazepam-2",
    nome: "Clonazepam",
    apresentacao: "2 mg comprimido",
    classe: "Benzodiazepínico",
    especialidade: "Psiquiatria",
    acao: "comprimido",
    farmaciaPopular: false,
    controlado: "B1",
    presets: [
      p(
        "1x-deitar",
        "2 mg ao deitar",
        "2 mg",
        cp(30),
        { ao_deitar: 1 },
        "Tomar 1 comprimido ao deitar.",
        "30 dias",
      ),
    ],
    alertas: ["Receita B1 (azul). Risco de dependência e quedas."],
  },

  // ── Analgesia / Geral ────────────────────────────────────────────────────
  {
    id: "dipirona-500",
    nome: "Dipirona",
    apresentacao: "500 mg comprimido",
    classe: "Analgésico/antitérmico",
    especialidade: "Analgesia/Geral",
    acao: "comprimido",
    farmaciaPopular: false,
    presets: [
      p(
        "sos",
        "500 mg se dor ou febre",
        "500 mg",
        cp(20),
        {},
        "Tomar 1 comprimido se tiver dor ou febre. Pode repetir a cada 6 horas se precisar.",
        "Se necessário",
      ),
    ],
  },
  {
    id: "dipirona-1g",
    nome: "Dipirona",
    apresentacao: "1 g comprimido",
    classe: "Analgésico/antitérmico",
    especialidade: "Analgesia/Geral",
    acao: "comprimido",
    farmaciaPopular: false,
    presets: [
      p(
        "sos",
        "1 g se dor ou febre",
        "1 g",
        cp(20),
        {},
        "Tomar 1 comprimido se tiver dor ou febre. Pode repetir a cada 6 horas se precisar.",
        "Se necessário",
      ),
    ],
  },
  {
    id: "paracetamol-750",
    nome: "Paracetamol",
    apresentacao: "750 mg comprimido",
    classe: "Analgésico/antitérmico",
    especialidade: "Analgesia/Geral",
    acao: "comprimido",
    farmaciaPopular: false,
    presets: [
      p(
        "sos",
        "750 mg se dor ou febre",
        "750 mg",
        cp(20),
        {},
        "Tomar 1 comprimido se tiver dor ou febre. Pode repetir a cada 6 horas. No máximo 4 por dia.",
        "Se necessário",
      ),
    ],
  },
  {
    id: "ibuprofeno-600",
    nome: "Ibuprofeno",
    apresentacao: "600 mg comprimido",
    classe: "Anti-inflamatório",
    especialidade: "Analgesia/Geral",
    acao: "comprimido",
    farmaciaPopular: false,
    presets: [
      p(
        "3x-5d",
        "600 mg de 8 em 8 horas por 5 dias",
        "600 mg",
        cp(15),
        { manha: 1, tarde: 1, noite: 1 },
        "Tomar 1 comprimido pela manhã, 1 à tarde e 1 à noite, após as refeições, por 5 dias.",
        "5 dias",
      ),
    ],
    alertas: ["Evitar em DRC, IC e úlcera."],
  },
];

export const CLASSES_POR_ESPECIALIDADE: Record<Especialidade, string[]> = ESPECIALIDADES.reduce(
  (acc, esp) => {
    acc[esp] = [
      ...new Set(MEDICAMENTOS.filter((m) => m.especialidade === esp).map((m) => m.classe)),
    ];
    return acc;
  },
  {} as Record<Especialidade, string[]>,
);

function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function buscarMedicamentos(
  query: string,
  filtros: {
    especialidade?: Especialidade | null;
    classe?: string | null;
    farmaciaPopular?: boolean;
  } = {},
): Medicamento[] {
  const q = normalize(query.trim());
  return MEDICAMENTOS.filter((m) => {
    if (filtros.especialidade && m.especialidade !== filtros.especialidade) return false;
    if (filtros.classe && m.classe !== filtros.classe) return false;
    if (filtros.farmaciaPopular && !m.farmaciaPopular) return false;
    if (!q) return true;
    return normalize(`${m.nome} ${m.classe} ${m.apresentacao}`).includes(q);
  });
}

export function getMedicamento(id: string): Medicamento | undefined {
  return MEDICAMENTOS.find((m) => m.id === id);
}
