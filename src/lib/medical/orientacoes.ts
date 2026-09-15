export type CategoriaOrientacao =
  | "Diabetes"
  | "Hipertensão"
  | "Insuficiência cardíaca"
  | "Pós-operatório"
  | "Anticoagulação"
  | "Antibiótico"
  | "Dieta"
  | "Sinais de alerta"
  | "Geral";

export interface Orientacao {
  id: string;
  titulo: string;
  categoria: CategoriaOrientacao;
  itens: string[];
  sinaisAlerta: string[];
}

export const ORIENTACOES: Orientacao[] = [
  {
    id: "diabetes",
    titulo: "Cuidados com o diabetes",
    categoria: "Diabetes",
    itens: [
      "Tome os remédios do diabetes todos os dias, nos horários marcados, mesmo que se sinta bem.",
      "Faça as refeições em horários regulares. Não pule refeições.",
      "Prefira alimentos integrais, verduras, legumes e frutas com casca. Evite doces, refrigerantes e sucos adoçados.",
      "Meça a glicemia conforme orientado e anote os valores para mostrar na consulta.",
      "Olhe os pés todos os dias. Procure feridas, bolhas ou vermelhidão. Use sapatos fechados e confortáveis.",
      "Caminhe pelo menos 30 minutos por dia, se liberado pelo médico.",
    ],
    sinaisAlerta: [
      "Glicemia abaixo de 70 (tremor, suor frio, confusão): coma 1 colher de açúcar ou 1 copo de suco e meça de novo em 15 minutos.",
      "Glicemia acima de 300 repetidas vezes, muita sede, urina em excesso ou vômitos: procure atendimento.",
      "Ferida no pé que não cicatriza ou fica escura: procure atendimento.",
    ],
  },
  {
    id: "hipertensao",
    titulo: "Cuidados com a pressão alta",
    categoria: "Hipertensão",
    itens: [
      "Tome o remédio da pressão todos os dias, no mesmo horário, mesmo que a pressão esteja boa.",
      "Reduza o sal: não use saleiro na mesa e evite embutidos, enlatados, temperos prontos e salgadinhos.",
      "Evite bebidas alcoólicas e não fume.",
      "Meça a pressão em casa ou na UBS e anote os valores.",
      "Mantenha o peso saudável e faça atividade física regular.",
    ],
    sinaisAlerta: [
      "Pressão acima de 180 x 110 com dor de cabeça forte, dor no peito, falta de ar, visão turva ou fraqueza em um lado do corpo: procure a emergência imediatamente.",
      "Tontura forte ou desmaio ao levantar: informe o médico (pode ser dose alta).",
    ],
  },
  {
    id: "insuficiencia-cardiaca",
    titulo: "Cuidados com o coração (insuficiência cardíaca)",
    categoria: "Insuficiência cardíaca",
    itens: [
      "Pese-se todas as manhãs, após urinar e antes do café, e anote o peso.",
      "Limite o sal e evite beber mais de 1,5 litro de líquidos por dia (contando água, sucos, sopas e café).",
      "Tome os diuréticos pela manhã para não atrapalhar o sono.",
      "Durma com a cabeceira elevada se sentir falta de ar deitado.",
      "Não pare os remédios do coração sem falar com o médico.",
    ],
    sinaisAlerta: [
      "Ganho de 2 kg ou mais em 3 dias, inchaço nas pernas que aumenta, ou falta de ar que piora: procure atendimento.",
      "Falta de ar em repouso, dor no peito ou desmaio: procure a emergência.",
    ],
  },
  {
    id: "pos-operatorio",
    titulo: "Cuidados após a cirurgia",
    categoria: "Pós-operatório",
    itens: [
      "Mantenha o curativo limpo e seco. Troque conforme orientado.",
      "Lave as mãos antes e depois de tocar no curativo.",
      "Tome os remédios para dor nos horários indicados, sem esperar a dor ficar forte.",
      "Evite esforço físico e carregar peso pelo tempo orientado pelo cirurgião.",
      "Caminhe dentro de casa várias vezes ao dia para evitar trombose.",
      "Compareça ao retorno na data marcada para retirar os pontos e avaliar a ferida.",
    ],
    sinaisAlerta: [
      "Febre acima de 38 °C, vermelhidão, calor, pus ou mau cheiro na ferida: procure atendimento.",
      "Sangramento que não para, dor que piora muito, vômitos repetidos ou barriga muito inchada: procure a emergência.",
      "Dor e inchaço em uma perna só, ou falta de ar súbita: procure a emergência.",
    ],
  },
  {
    id: "anticoagulacao",
    titulo: "Cuidados com o anticoagulante",
    categoria: "Anticoagulação",
    itens: [
      "Tome o anticoagulante sempre no mesmo horário. Se esquecer, tome assim que lembrar no mesmo dia; nunca tome dose dobrada.",
      "Avise qualquer médico ou dentista que você usa anticoagulante antes de procedimentos.",
      "Não tome anti-inflamatórios (ibuprofeno, diclofenaco, nimesulida) nem aspirina sem orientação.",
      "Se usar varfarina, mantenha a alimentação regular (verduras verde-escuras em quantidade constante) e faça o exame de INR na data marcada.",
      "Use escova de dentes macia e barbeador elétrico.",
    ],
    sinaisAlerta: [
      "Sangue na urina ou nas fezes (fezes pretas), vômito com sangue, sangramento nasal ou gengival que não para: procure a emergência.",
      "Queda com batida na cabeça, mesmo sem dor: procure atendimento.",
      "Manchas roxas grandes que aparecem sem motivo: informe o médico.",
    ],
  },
  {
    id: "antibiotico",
    titulo: "Como usar o antibiótico",
    categoria: "Antibiótico",
    itens: [
      "Tome o antibiótico nos horários certos até o último dia, mesmo que já se sinta melhor.",
      "Não pule doses. Se esquecer, tome assim que lembrar e siga o horário normal; não dobre a dose.",
      "Não guarde sobras para usar depois e não dê para outras pessoas.",
      "Alguns antibióticos devem ser tomados com alimento para não causar enjoo (veja a receita).",
    ],
    sinaisAlerta: [
      "Manchas vermelhas na pele, coceira, inchaço no rosto ou dificuldade para respirar: pare o remédio e procure a emergência.",
      "Diarreia forte com muitas evacuações por dia: procure atendimento.",
      "Febre que não melhora após 3 dias de antibiótico: procure atendimento.",
    ],
  },
  {
    id: "dieta-hipossodica",
    titulo: "Dieta com pouco sal",
    categoria: "Dieta",
    itens: [
      "Use no máximo 1 colher de chá rasa de sal por dia no preparo dos alimentos.",
      "Tempere com alho, cebola, limão, ervas e especiarias no lugar do sal.",
      "Evite: embutidos (salsicha, linguiça, presunto), enlatados, temperos prontos em cubo, molhos prontos, salgadinhos, macarrão instantâneo e queijos amarelos.",
      "Leia os rótulos: prefira produtos com menos de 400 mg de sódio por porção.",
    ],
    sinaisAlerta: [],
  },
  {
    id: "sinais-alerta-gerais",
    titulo: "Quando procurar a emergência",
    categoria: "Sinais de alerta",
    itens: [
      "Guarde este papel em local visível e mostre para a família.",
      "Em caso de dúvida, procure a UBS mais próxima ou ligue 192 (SAMU).",
    ],
    sinaisAlerta: [
      "Dor no peito forte ou aperto que dura mais de 20 minutos.",
      "Falta de ar súbita ou que piora rapidamente.",
      "Fraqueza ou dormência em um lado do corpo, boca torta, dificuldade para falar.",
      "Febre acima de 39 °C que não baixa, ou febre com calafrios e confusão mental.",
      "Vômitos ou diarreia que não param por mais de 24 horas, sem conseguir beber líquidos.",
      "Desmaio, convulsão ou sonolência excessiva.",
      "Sangramento que não para.",
    ],
  },
  {
    id: "quedas-idoso",
    titulo: "Prevenção de quedas",
    categoria: "Geral",
    itens: [
      "Levante-se devagar da cama e da cadeira: sente-se, espere alguns segundos, depois fique em pé.",
      "Use calçados fechados com sola antiderrapante. Evite chinelos.",
      "Retire tapetes soltos, deixe os caminhos livres e mantenha luz acesa à noite (abajur no corredor e no banheiro).",
      "Instale barras de apoio no banheiro e use tapete antiderrapante no box.",
      "Use óculos e bengala/andador se indicados.",
    ],
    sinaisAlerta: ["Após qualquer queda com batida na cabeça, dor forte ou dificuldade para andar: procure atendimento."],
  },
  {
    id: "retorno-e-exames",
    titulo: "Retorno e exames",
    categoria: "Geral",
    itens: [
      "Marque o retorno na UBS ou no ambulatório na data indicada nesta orientação.",
      "Leve esta orientação, a receita e os exames na consulta de retorno.",
      "Faça os exames pedidos antes do retorno, se possível.",
      "Traga todos os remédios (ou as caixas) que usa em casa para conferência.",
    ],
    sinaisAlerta: [],
  },
];

export const CATEGORIAS_ORIENTACAO: CategoriaOrientacao[] = [
  "Diabetes",
  "Hipertensão",
  "Insuficiência cardíaca",
  "Pós-operatório",
  "Anticoagulação",
  "Antibiótico",
  "Dieta",
  "Sinais de alerta",
  "Geral",
];

export function getOrientacao(id: string): Orientacao | undefined {
  return ORIENTACOES.find((o) => o.id === id);
}
