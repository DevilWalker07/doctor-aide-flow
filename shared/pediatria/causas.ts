/**
 * Causas reversíveis da PCR (6 Hs e 5 Ts) e a conduta de cada uma, seguindo
 * o PALS. As doses vêm da ficha (`DROGAS_BOLUS` + `DROGAS_EXTRAS`) pelo id;
 * os volumes são calculados pelo peso. Onde o PALS não fixa dose (trombólise,
 * reposição de potássio), a conduta diz isso em vez de inventar número.
 */

export type Procedimento = "pericardiocentese" | "descompressao";

export interface VolumePorKg {
  nome: string;
  mlPorKg: number;
  nota?: string;
}

export interface Antidoto {
  /** Intoxicação ou classe de droga. */
  agente: string;
  /** id da droga na ficha. */
  drogaId: string;
}

export interface Causa {
  id: string;
  grupo: "H" | "T";
  nome: string;
  /** Pistas que sugerem a causa. */
  pistas: string[];
  /** Conduta, na ordem. */
  passos: string[];
  /** Drogas da ficha usadas nesta causa (registráveis). */
  drogas?: { id: string; papel: string }[];
  volumes?: VolumePorKg[];
  procedimento?: Procedimento;
  antidotos?: Antidoto[];
}

export const CAUSAS: Causa[] = [
  {
    id: "hipovolemia",
    grupo: "H",
    nome: "Hipovolemia",
    pistas: ["Diarreia, vômitos, sangramento, queimadura", "AESP com taquicardia antes da parada"],
    passos: [
      "Bolus de cristaloide isotônico em push rápido, pelo acesso IV ou IO.",
      "Reavalie após cada bolus e repita se necessário.",
      "Sangramento: concentrado de hemácias e controle da hemorragia.",
    ],
    volumes: [
      { nome: "SF 0,9% ou Ringer lactato", mlPorKg: 20 },
      { nome: "Concentrado de hemácias", mlPorKg: 10, nota: "hemorragia" },
    ],
  },
  {
    id: "hipoxia",
    grupo: "H",
    nome: "Hipóxia",
    pistas: ["Causa respiratória antes da parada", "Ventilação difícil ou expansão torácica ruim"],
    passos: [
      "Oxigênio a 100% e ventilação eficaz: tórax deve expandir a cada ventilação.",
      "Confirme o tubo com capnografia.",
      "Piora com tubo: DOPE — Deslocamento, Obstrução, Pneumotórax, Equipamento.",
    ],
  },
  {
    id: "acidose",
    grupo: "H",
    nome: "Hidrogênio (acidose)",
    pistas: ["PCR prolongada", "Acidose metabólica grave conhecida"],
    passos: [
      "Ventilação adequada — é o principal tratamento.",
      "Bicarbonato de sódio na acidose metabólica grave, hipercalemia ou intoxicação por tricíclico.",
    ],
    drogas: [{ id: "bicarbonato", papel: "Acidose grave, hipercalemia, tricíclico" }],
  },
  {
    id: "hipoglicemia",
    grupo: "H",
    nome: "Hipoglicemia",
    pistas: [
      "Glicemia capilar baixa",
      "Lactente, jejum prolongado, sepse, insulina ou hipoglicemiante",
    ],
    passos: ["Cheque a glicemia capilar.", "Glicose IV/IO e nova glicemia em seguida."],
    drogas: [{ id: "glicose-25", papel: "0,5 g/kg" }],
    volumes: [{ nome: "Glicose 10% (alternativa)", mlPorKg: 5, nota: "0,5 g/kg" }],
  },
  {
    id: "potassio",
    grupo: "H",
    nome: "Hipo/hipercalemia",
    pistas: ["Insuficiência renal, rabdomiólise, hemólise", "Onda T apiculada, QRS largo"],
    passos: [
      "Hipercalemia: cálcio para estabilizar a membrana, depois desviar o potássio para dentro da célula (bicarbonato; glicose com insulina).",
      "Hipocalemia: reposição de potássio IV em bomba, conforme o protocolo do serviço.",
    ],
    drogas: [
      { id: "gluconato-calcio", papel: "Hipercalemia: estabiliza a membrana" },
      { id: "bicarbonato", papel: "Hipercalemia" },
      { id: "glicose-25", papel: "Com insulina, na hipercalemia" },
    ],
  },
  {
    id: "hipotermia",
    grupo: "H",
    nome: "Hipotermia",
    pistas: ["Afogamento, exposição ao frio", "Temperatura central baixa"],
    passos: [
      "Aquecimento ativo: retirar roupa molhada, mantas térmicas, fluidos aquecidos.",
      "Continue a RCP até reaquecer: não declarar óbito em hipotermia.",
    ],
  },
  {
    id: "pneumotorax",
    grupo: "T",
    nome: "Tensão no tórax (pneumotórax)",
    pistas: [
      "Murmúrio abolido e hipertimpanismo de um lado",
      "Desvio da traqueia, turgência jugular",
      "Piora súbita após intubação ou ventilação",
    ],
    passos: [
      "Descompressão imediata por agulha — não espere radiografia.",
      "Depois, drenagem torácica.",
    ],
    procedimento: "descompressao",
  },
  {
    id: "tamponamento",
    grupo: "T",
    nome: "Tamponamento cardíaco",
    pistas: [
      "Trauma torácico, pós-operatório cardíaco",
      "Bulhas abafadas, turgência jugular",
      "AESP; derrame pericárdico no ultrassom",
    ],
    passos: [
      "Pericardiocentese de urgência, guiada por ultrassom se disponível.",
      "Bolus de volume enquanto prepara o procedimento.",
      "Acione a cirurgia cardíaca.",
    ],
    procedimento: "pericardiocentese",
    volumes: [{ nome: "SF 0,9% ou Ringer lactato", mlPorKg: 20 }],
  },
  {
    id: "toxinas",
    grupo: "T",
    nome: "Toxinas",
    pistas: ["Ingestão ou exposição relatada", "Toxíndrome: pupilas, pele, FC, QRS largo"],
    passos: [
      "Identifique o agente e trate com o antídoto quando houver.",
      "Disque-Intoxicação (Anvisa): 0800 722 6001.",
    ],
    antidotos: [
      { agente: "Opioides", drogaId: "naloxona" },
      {
        agente: "Tricíclicos e bloqueadores de canal de sódio (QRS largo)",
        drogaId: "bicarbonato",
      },
      { agente: "Bloqueadores de canal de cálcio, hipermagnesemia", drogaId: "gluconato-calcio" },
      { agente: "Hipoglicemiantes (insulina, sulfonilureia)", drogaId: "glicose-25" },
      { agente: "Torsades de pointes por droga", drogaId: "magnesio" },
    ],
  },
  {
    id: "tep",
    grupo: "T",
    nome: "Trombose pulmonar",
    pistas: ["Cateter venoso central, imobilização, trombofilia", "Hipóxia desproporcional"],
    passos: [
      "Raro em pediatria.",
      "Trombólise sem dose pediátrica definida no PALS: decidir com o especialista.",
    ],
  },
  {
    id: "coronaria",
    grupo: "T",
    nome: "Trombose coronária",
    pistas: ["Doença de Kawasaki, cardiopatia congênita, uso de cocaína"],
    passos: [
      "Raro em pediatria.",
      "ECG de 12 derivações após o RCE e contato com a cardiologia pediátrica.",
    ],
  },
];

export const causaPorNome = (nome: string) => CAUSAS.find((c) => c.nome === nome);

export const PROCEDIMENTOS: Record<
  Procedimento,
  { titulo: string; passos: string[]; material: string }
> = {
  pericardiocentese: {
    titulo: "Pericardiocentese subxifoide",
    material:
      "Cateter sobre agulha 18–20G (adolescente 16–18G), seringa de 20 mL, torneira de 3 vias",
    passos: [
      "Monitor de ECG contínuo; se possível, guie por ultrassom.",
      "Antissepsia rápida da região subxifoide.",
      "Punção 1 cm abaixo e à esquerda do apêndice xifoide.",
      "Agulha a 30–45° com a pele, apontando para o ombro esquerdo.",
      "Avance aspirando sempre, até refluir líquido ou sangue.",
      "Arritmia ou alteração do ST no monitor: recue a agulha.",
      "Aspire o máximo possível — 5 a 10 mL já podem devolver o débito.",
      "Deixe o cateter, fixe e reavalie ritmo e pulso.",
    ],
  },
  descompressao: {
    titulo: "Descompressão torácica por agulha",
    material: "Cateter sobre agulha 18–20G (adolescente 14–16G) com seringa",
    passos: [
      "Confirme o lado: murmúrio abolido, hipertimpanismo, traqueia desviada para o lado oposto.",
      "Ponto: 2º espaço intercostal na linha hemiclavicular, na borda superior da 3ª costela.",
      "Alternativa: 4º ou 5º espaço intercostal na linha axilar média.",
      "Introduza perpendicular à pele, aspirando, até sair ar.",
      "Retire a agulha e mantenha o cateter aberto, fixado.",
      "Prepare a drenagem torácica.",
    ],
  },
};

/** Volume em mL de um bolus por kg. */
export const volumeBolus = (mlPorKg: number, peso: number) => Math.round(mlPorKg * peso);
