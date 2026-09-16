export const ESPECIALIDADES_ENCAMINHAMENTO = [
  "Cardiologia",
  "Nefrologia",
  "Endocrinologia",
  "Neurologia",
  "Psiquiatria",
  "Pneumologia",
  "Gastroenterologia",
  "Cirurgia geral",
  "Ortopedia",
  "Oncologia",
  "Infectologia",
  "Fisioterapia",
  "Nutrição",
  "Serviço social",
  "UBS / Atenção primária",
  "CAPS",
  "Regulação",
  "Outro",
] as const;

export type EspecialidadeEncaminhamento = (typeof ESPECIALIDADES_ENCAMINHAMENTO)[number];

export const PRIORIDADES_ENCAMINHAMENTO = [
  { id: "eletivo", label: "Eletivo", descricao: "Rotina — pode aguardar agenda" },
  { id: "prioritario", label: "Prioritário", descricao: "Avaliar em até 30 dias" },
  { id: "urgente", label: "Urgente", descricao: "Avaliar em até 7 dias" },
] as const;

export type PrioridadeEncaminhamento = (typeof PRIORIDADES_ENCAMINHAMENTO)[number]["id"];

export interface EncaminhamentoForm {
  destino: string;
  destinoOutro?: string;
  prioridade: PrioridadeEncaminhamento;
  hipoteses: string[];
  resumoClinico: string;
  justificativa: string;
  exames: string[];
  solicitacao: string;
}

export const EXAMES_COMUNS = [
  "Hemograma",
  "Creatinina / Ureia",
  "Eletrólitos (Na, K)",
  "Glicemia / HbA1c",
  "Perfil lipídico",
  "TSH",
  "ECG",
  "Ecocardiograma",
  "RX de tórax",
  "TC de crânio",
  "Ultrassom de abdome",
  "Urina tipo I / Urocultura",
];

export function destinoLabel(form: Pick<EncaminhamentoForm, "destino" | "destinoOutro">): string {
  return form.destino === "Outro" ? form.destinoOutro?.trim() || "Outro serviço" : form.destino;
}

export function montarEncaminhamento(form: EncaminhamentoForm, paciente: { nome: string; idade?: string; sexo?: string }, data: string): string {
  const prioridade = PRIORIDADES_ENCAMINHAMENTO.find((p) => p.id === form.prioridade);
  const identificacao = [paciente.nome || "NÃO INFORMADO", paciente.idade ? `${paciente.idade} anos` : null, paciente.sexo || null]
    .filter(Boolean)
    .join(", ");

  const linhas = [
    "ENCAMINHAMENTO MÉDICO",
    `Data: ${data}`,
    `Paciente: ${identificacao}`,
    `Destino: ${destinoLabel(form)}`,
    `Prioridade: ${prioridade?.label ?? form.prioridade}`,
    "",
    "RESUMO CLÍNICO",
    form.resumoClinico.trim() || "Não informado.",
    "",
    "MOTIVO DO ENCAMINHAMENTO",
    form.justificativa.trim() || "Não informado.",
  ];

  if (form.hipoteses.length) {
    linhas.push("", "HIPÓTESES DIAGNÓSTICAS", ...form.hipoteses.map((h) => `- ${h}`));
  }
  if (form.exames.length) {
    linhas.push("", "EXAMES EM ANEXO", ...form.exames.map((e) => `- ${e}`));
  }
  linhas.push("", "SOLICITAÇÃO", form.solicitacao.trim() || "Solicito avaliação e conduta.");

  return linhas.join("\n");
}
