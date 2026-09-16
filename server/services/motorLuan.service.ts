import { AIResponseError } from "../lib/errors.js";
import { BRIEFING_PROMPT } from "../prompts/briefing.prompt.js";
import { CLINICA_MEDICA_PROMPT } from "../prompts/clinicaMedica.prompt.js";
import { COPILOTO_PROMPT } from "../prompts/copiloto.prompt.js";
import { EVOLUTION_REVIEWER_PROMPT } from "../prompts/evolutionReviewer.prompt.js";
import { GERADOR_ENCAMINHAMENTO_PROMPT } from "../prompts/geradorEncaminhamento.prompt.js";
import { GERADOR_EVOLUCAO_PROMPT } from "../prompts/geradorEvolucao.prompt.js";
import { LAB_EXTRACTOR_PROMPT } from "../prompts/labExtractor.prompt.js";
import { LAUDO_IMAGEM_PROMPT } from "../prompts/laudoImagem.prompt.js";
import { MAPA_PLANTAO_PROMPT } from "../prompts/mapaPlantao.prompt.js";
import { ORQUESTRADOR_PROMPT } from "../prompts/orquestrador.prompt.js";
import { PEDIATRIA_PROMPT } from "../prompts/pediatria.prompt.js";
import { SUGESTOR_RECEITA_PROMPT } from "../prompts/sugestorReceita.prompt.js";
import { UTI_PROMPT } from "../prompts/uti.prompt.js";
import {
  ClinicalExtractionOutputSchema,
  EvolutionReviewSchema,
  LabExtractionSchema,
  LaudoImagemSchema,
  OrquestradorOutputSchema,
  SugestaoReceitaSchema,
  type ClinicalExtractionOutput,
  type CopilotoBody,
  type EncaminhamentoBody,
  type EvolucaoBody,
  type EvolutionReviewBody,
  type LaudoImagemBody,
  type MotorLuanTextBody,
  type RoundBody,
  type SugerirReceitaBody,
} from "../schemas/ai.schemas.js";
import {
  findingsToAlerts,
  mergeAlerts,
  parseLabString,
  parseVitalsFromText,
  runPatientGuardrails,
} from "./clinicalGuardrails.js";
import {
  chatCompletion,
  safeJsonCompletion,
  textCompletion,
  type SafeResult,
} from "./openaiClient.js";
import { gerarBriefingLocal, gerarMapaPlantaoLocal } from "./round.service.js";

const NO_PATIENTS_ALERT = "IA NÃO IDENTIFICOU PACIENTES NO TEXTO";

/** Enquadramento por especialidade, somado ao prompt do copiloto. */
const ENQUADRAMENTO_AGENTE: Record<string, string> = {
  geral: "",
  "clinica-medica":
    "Especialidade: CLÍNICA MÉDICA DO ADULTO. Priorize ajuste renal e hepático, interação medicamentosa e metas de doença crônica.",
  pediatria:
    "Especialidade: PEDIATRIA. Doses SEMPRE por peso (mg/kg/dia) com o teto de adulto explícito. Se o peso não foi informado, peça o peso antes de sugerir dose.",
  uti: "Especialidade: TERAPIA INTENSIVA. Considere droga vasoativa, ventilação mecânica, sedação e analgesia, e diluição em bomba de infusão.",
};

function unwrap<T>(result: SafeResult<T>): T {
  if (result.ok) return result.data;
  throw new AIResponseError(result.error, result.raw);
}

function applyGuardrails(out: ClinicalExtractionOutput): ClinicalExtractionOutput {
  const globais: string[] = [];
  for (const p of out.patients) {
    const idade = Number.parseInt(p.idade, 10);
    const findings = runPatientGuardrails({
      laboratorio: p.laboratorio,
      antibioticos: p.antibioticos,
      quadro: p.quadro,
      idade: Number.isFinite(idade) ? idade : null,
      sexo: p.sexo,
    });
    if (findings.length === 0) continue;
    p.alertas = mergeAlerts(p.alertas, findingsToAlerts(findings));
    const criticos = findingsToAlerts(findings, true);
    if (criticos.length) globais.push(`${p.leito}: ${criticos.join("; ")}`);
  }
  if (out.patients.length === 0 && !out.globalAlerts.includes(NO_PATIENTS_ALERT))
    globais.push(NO_PATIENTS_ALERT);
  out.globalAlerts = mergeAlerts(out.globalAlerts, globais);
  return out;
}

async function extract(prompt: string, body: MotorLuanTextBody) {
  return applyGuardrails(
    unwrap(
      await safeJsonCompletion(prompt, body, ClinicalExtractionOutputSchema, {
        mockKey: "clinicaMedica",
        maxTokens: 6000,
      }),
    ),
  );
}

export const motorLuanService = {
  async orquestrador(body: MotorLuanTextBody) {
    const out = unwrap(
      await safeJsonCompletion(ORQUESTRADOR_PROMPT, body, OrquestradorOutputSchema, {
        mockKey: "orquestrador",
        maxTokens: 6000,
      }),
    );
    return {
      ...out,
      ...applyGuardrails({ patients: out.patients, globalAlerts: out.globalAlerts }),
    };
  },

  async extrairClinicaMedica(body: MotorLuanTextBody) {
    if (body.task === "lab-extractor") {
      return unwrap(
        await safeJsonCompletion(LAB_EXTRACTOR_PROMPT, body, LabExtractionSchema, {
          mockKey: "lab",
        }),
      );
    }
    return extract(CLINICA_MEDICA_PROMPT, body);
  },

  extrairPediatria: (body: MotorLuanTextBody) => extract(PEDIATRIA_PROMPT, body),
  extrairUti: (body: MotorLuanTextBody) => extract(UTI_PROMPT, body),
  importarEvolucoesOntem: (body: MotorLuanTextBody) => extract(CLINICA_MEDICA_PROMPT, body),

  async gerarEvolucao(body: EvolucaoBody) {
    const text = await textCompletion(GERADOR_EVOLUCAO_PROMPT, body, {
      mockKey: "evolucao",
      maxTokens: 3000,
    });
    if (!text) throw new AIResponseError("A IA não gerou texto de evolução.");
    const uppercase = body.preferences?.uppercase ?? true;
    return { text: uppercase ? text.toUpperCase() : text };
  },

  async reviewEvolution(body: EvolutionReviewBody) {
    const review = unwrap(
      await safeJsonCompletion(EVOLUTION_REVIEWER_PROMPT, body, EvolutionReviewSchema, {
        mockKey: "evolutionReview",
      }),
    );
    const patient = (body.patient ?? {}) as Record<string, unknown>;
    const labsTexto = [
      ...(Array.isArray(patient.labs)
        ? (patient.labs as Array<Record<string, unknown>>).map((l) =>
            String(l.texto_compacto ?? ""),
          )
        : []),
      typeof patient.laboratorio === "string" ? patient.laboratorio : "",
    ].join(" / ");
    const findings = runPatientGuardrails({
      labs: { ...parseLabString(labsTexto), ...parseLabString(body.evolutionText) },
      vitals: parseVitalsFromText(body.evolutionText),
      antibioticos: Array.isArray(patient.antibiotics)
        ? (patient.antibiotics as Array<Record<string, unknown>>)
            .map((a) => [a.nome, a.dose, a.via, a.frequencia].filter(Boolean).join(" "))
            .join("\n")
        : typeof patient.antibioticos === "string"
          ? patient.antibioticos
          : null,
    });
    return { ...review, alertas: mergeAlerts(review.alertas, findingsToAlerts(findings)) };
  },

  async gerarMapaPlantao(body: RoundBody) {
    const text = await textCompletion(MAPA_PLANTAO_PROMPT, body, {
      mockKey: "mapa",
      maxTokens: 6000,
    });
    return {
      text: text || gerarMapaPlantaoLocal(body.patients, body.sector, body.date),
      source: text ? "ai" : "local",
    };
  },

  async gerarBriefing(body: RoundBody) {
    const text = await textCompletion(BRIEFING_PROMPT, body, {
      mockKey: "briefing",
      maxTokens: 3000,
    });
    return {
      text: text || gerarBriefingLocal(body.patients, body.sector, body.date),
      source: text ? "ai" : "local",
    };
  },

  async gerarEncaminhamento(body: EncaminhamentoBody) {
    const text = await textCompletion(GERADOR_ENCAMINHAMENTO_PROMPT, body, {
      mockKey: "encaminhamento",
      maxTokens: 1500,
    });
    if (!text) throw new AIResponseError("A IA não gerou o texto do encaminhamento.");
    return { referral_text: text };
  },

  async copiloto(body: CopilotoBody) {
    // O agente só enquadra a resposta; as regras de segurança do copiloto
    // (citar referência, pedir o dado que falta, terminar com "Confira:")
    // continuam vindo do COPILOTO_PROMPT e não são substituídas.
    const partes = [COPILOTO_PROMPT];
    const enquadramento = ENQUADRAMENTO_AGENTE[body.agente ?? "geral"];
    if (enquadramento) partes.push(enquadramento);
    if (body.ambiente) partes.push(`ambiente: ${body.ambiente}`);

    const reply = await chatCompletion(partes.join("\n"), body.messages, { mockKey: "copiloto" });
    if (!reply) throw new AIResponseError("O copiloto não respondeu.");
    return { reply };
  },

  async organizarLaudoImagem(body: LaudoImagemBody) {
    return unwrap(
      await safeJsonCompletion(LAUDO_IMAGEM_PROMPT, body, LaudoImagemSchema, {
        mockKey: "laudoImagem",
        maxTokens: 3000,
      }),
    );
  },

  async sugerirReceita(body: SugerirReceitaBody) {
    return unwrap(
      await safeJsonCompletion(SUGESTOR_RECEITA_PROMPT, body, SugestaoReceitaSchema, {
        mockKey: "receita",
        maxTokens: 3000,
      }),
    );
  },
};
