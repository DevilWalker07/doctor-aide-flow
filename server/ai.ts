import OpenAI from "openai";
import { DEFAULT_MODEL, prompts } from "./prompts.js";

const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export const mockPatients = [
  { id: "L01", leito: "L01", nome: "MARIA DE LOURDES DA SILVA FERREIRA", idade: "88", sexo: "F", diagnosticos: "PAC, HDA ESTABILIZADA", comorbidades: "HAS, DM2, SEQUELA DE AVC", dispositivos: "JELCO MSD, SVD", antibioticos: "MEROPENEM 1G EV 8/8H - D5/10", laboratorio: "HB 9,2 / HT 28 / LEUCO 14.400 / CR 1,8 / PCR 42", quadro: "GRAVE ESTADO GERAL, CLINICAMENTE INSTÁVEL, EUPNEICA EM AR AMBIENTE.", intercorrencias: "MOVIMENTOS REPETITIVOS EM HEMIFACE ESQUERDA.", pendencias: "FONOAUDIOLOGIA E EXTRAÇÃO DENTÁRIA.", alertas: ["RISCO DE ASPIRAÇÃO", "ALERTA RENAL"] },
  { id: "L02", leito: "L02", nome: "VANUZIA PEREIRA DE SOUZA SILVA", idade: "55", sexo: "F", diagnosticos: "PAC", comorbidades: "ROUQUIDÃO CRÔNICA, COLAPSO T12", dispositivos: "JELCO MSE", antibioticos: "CEFTRIAXONA D7/10 + AZITROMICINA D5/5", laboratorio: "PCR 28", quadro: "BEG, ESTÁVEL, EUPNEICA EM AR AMBIENTE.", intercorrencias: "SEM INTERCORRÊNCIAS.", pendencias: "RNM DE TÓRAX COM CONTRASTE.", alertas: ["ATB FINALIZANDO"] },
  { id: "L03", leito: "L03", nome: "DIANA RIBEIRO", idade: "41", sexo: "F", diagnosticos: "ERISIPELA BOLHOSA MID, PÉ DIABÉTICO", comorbidades: "ESQUIZOFRENIA, DM, OBESIDADE", dispositivos: "JELCO MSE", antibioticos: "PIPERACILINA-TAZOBACTAM D1/10", laboratorio: "LEUCO 18.200 / PCR 33", quadro: "REG, ESTÁVEL, FERIDA COM SINAIS FLOGÍSTICOS.", intercorrencias: "DEBRIDAMENTO CIRÚRGICO EM 08/04.", pendencias: "PARECER DA PSIQUIATRIA PARA ALTA.", alertas: ["FERIDA INFECTADA", "FALHA TERAPÊUTICA"] },
  { id: "L04", leito: "L04", nome: "TERESINHA CAMPOS NUNES", idade: "80", sexo: "F", diagnosticos: "DAOP CRÍTICA, ITU", comorbidades: "PÉ DIABÉTICO, HAS, DM2", dispositivos: "JELCO MSE", antibioticos: "CIPROFLOXACINO D2/7", laboratorio: "CR 1,1 / PCR 12", quadro: "REG, ESTÁVEL, DELIRIUM NOTURNO.", intercorrencias: "SEM INTERCORRÊNCIAS.", pendencias: "REGULAÇÃO JUDICIAL PARA ANGIOPLASTIA DE MID.", alertas: ["DELIRIUM", "AGUARDA REGULAÇÃO"] },
  { id: "L05", leito: "L05", nome: "MARINA ROSA DE JESUS", idade: "86", sexo: "F", diagnosticos: "DM DESCOMPENSADA, PAC", comorbidades: "HAS, ALZHEIMER", dispositivos: "JELCO MD, SNE EM PAUSA", antibioticos: "CEFTRIAXONA D5/7", laboratorio: "HB 8,5 / HT 24 / VCM 112 / PCR 85", quadro: "REG, EUPNEICA EM AR AMBIENTE. VÔMITOS APÓS DIETA.", intercorrencias: "VÔMITOS.", pendencias: "RNM ENCÉFALO E ENDOCRINOLOGIA.", alertas: ["ANEMIA SEVERA", "RISCO DE ASPIRAÇÃO"] },
  { id: "L06", leito: "L06", nome: "EDITE SOARES DE SOUZA", idade: "78", sexo: "F", diagnosticos: "DRC AGUDIZADA, ITU", comorbidades: "ALZHEIMER, HAS, DM2", dispositivos: "JELCO MSE", antibioticos: "TAZOCIN D14/14", laboratorio: "CR 1,6 / UR 88 / K 5,2 / PCR 8", quadro: "REG, ESTÁVEL, DESORIENTAÇÃO BASAL.", intercorrencias: "SEM INTERCORRÊNCIAS.", pendencias: "RELATÓRIO PARA NEFROLOGIA.", alertas: ["ALERTA RENAL", "ATB FINALIZANDO"] },
  { id: "L07", leito: "L07", nome: "MARIA APARECIDA FEITOSA SANTOS", idade: "75", sexo: "F", diagnosticos: "PAC REFRATÁRIA", comorbidades: "DM2, HAS, HIPOTIREOIDISMO", dispositivos: "JELCO MSD", antibioticos: "LEVOFLOXACINO D7/10", laboratorio: "LEUCO 11.800 / PCR 18", quadro: "REG, ESTÁVEL. DISGLICEMIAS EM USO DE CORTICOIDE.", intercorrencias: "SEM INTERCORRÊNCIAS.", pendencias: "MONITORIZAÇÃO GLICÊMICA E AJUSTE INSULINA.", alertas: ["DISGLICEMIA"] },
];

async function jsonCompletion(system: string, payload: unknown) {
  if (!client) return null;
  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(payload, null, 2) },
    ],
  });
  return JSON.parse(response.choices[0]?.message?.content || "{}");
}

async function textCompletion(system: string, payload: unknown) {
  if (!client) return null;
  const response = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    temperature: 0.2,
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(payload, null, 2) },
    ],
  });
  return response.choices[0]?.message?.content || "";
}

export async function extractLab(body: unknown) {
  const ai = await jsonCompletion(prompts.labExtractor, body);
  return ai || {
    data_exame: new Date().toLocaleDateString("pt-BR"),
    tipo_exame: "LABORATÓRIO",
    valores: {},
    texto_formatado: "LAB ATUAL: MOCK - COLE O TEXTO NO FRONTEND PARA EXTRAÇÃO LOCAL.",
    eas_formatado: "",
    alertas: ["MODO MOCK"],
    valores_duvidosos: [],
    campos_nao_encontrados: [],
  };
}

export async function generateEvolution(body: unknown) {
  const text = await textCompletion(prompts.evolutionGenerator, body);
  return { text: (text || "EVOLUÇÃO MÉDICA\n\nDADOS NÃO REFERIDOS. REVISAR MANUALMENTE.").toUpperCase() };
}

export async function reviewEvolution(body: { evolutionText?: string }) {
  return await jsonCompletion(prompts.reviewer, body) || { campos_faltantes: [], inconsistencias: [], alertas: [], sugestoes: ["REVISAR MANUALMENTE."] };
}

export async function importYesterday(body: unknown) {
  const ai = await jsonCompletion(prompts.yesterdayImport, body);
  if (ai?.patients?.length) {
    return {
      patients: ai.patients.map((p: any, index: number) => ({
        id: p.bed || p.leito || `L${index + 1}`,
        leito: p.bed || p.leito,
        nome: p.name || p.nome,
        idade: String(p.age || p.idade || ""),
        sexo: p.sex || p.sexo || "F",
        diagnosticos: Array.isArray(p.diagnoses) ? p.diagnoses.join(", ") : p.diagnosticos || "",
        comorbidades: Array.isArray(p.comorbidities) ? p.comorbidities.join(", ") : p.comorbidades || "",
        dispositivos: Array.isArray(p.devices) ? p.devices.join(", ") : p.dispositivos || "",
        antibioticos: p.antibiotics || p.antibioticos || "",
        laboratorio: p.labs || p.laboratorio || "",
        quadro: p.currentStatus || p.quadro || p.summary || "",
        intercorrencias: p.intercorrencias || "",
        pendencias: p.pendingIssues || p.pendencias || "",
        alertas: p.alerts || p.alertas || [],
        memory: p.memory || [],
      })),
      globalAlerts: ai.globalAlerts || [],
    };
  }
  return { patients: mockPatients, globalAlerts: ["MODO MOCK: OPENAI_API_KEY AUSENTE OU RESPOSTA VAZIA"] };
}

export async function roundMap(body: any) {
  const text = await textCompletion(prompts.roundMap, body);
  return { text: text || body.patients.map((p: any) => `${p.leito} - ${p.nome}\nPendências: ${p.pendencias}`).join("\n\n") };
}

export async function briefing(body: any) {
  const text = await textCompletion(prompts.briefing, body);
  return { text: text || `BRIEFING DE PLANTÃO - ${body.sector}\nTOTAL: ${body.patients.length} PACIENTES\nPRIORIZAR ALERTAS CRÍTICOS, FUNÇÃO RENAL E ANTIBIÓTICOS.` };
}
