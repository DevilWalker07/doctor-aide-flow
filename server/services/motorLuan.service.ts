import { ESPECIALISTAS, type EspecialistaId } from "../../shared/especialistas.js";
import { modeloCopiloto, modeloVisao } from "../config.js";
import { AIResponseError } from "../lib/errors.js";
import { BRIEFING_PROMPT } from "../prompts/briefing.prompt.js";
import { CLINICA_MEDICA_PROMPT } from "../prompts/clinicaMedica.prompt.js";
import { COPILOTO_PROMPT } from "../prompts/copiloto.prompt.js";
import { PROMPTS_ESPECIALISTAS } from "../prompts/especialistas.prompt.js";
import { extractPdfText, renderPdfPagesToJpeg } from "./pdf.service.js";
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
  LaboratorioBody,
  LaudoImagemSchema,
  OrquestradorOutputSchema,
  ParecerEspecialistaSchema,
  SugestaoReceitaSchema,
  type ClinicalExtractionOutput,
  type CopilotoBody,
  type EncaminhamentoBody,
  type EvolucaoBody,
  type EvolutionReviewBody,
  type LaudoImagemBody,
  type MotorLuanTextBody,
  type ParecerEspecialistaBody,
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
/**
 * Persona no chat, montada da identidade do especialista.
 *
 * Não é o prompt do parecer: aquele exige JSON e análise por seções, e no chat
 * o médico quer uma resposta curta. Aqui entram nome, título, personalidade e
 * as bases de evidência que o próprio prompt dele cita — nada inventado.
 */
function personaDoChat(id: EspecialistaId): string {
  const e = ESPECIALISTAS[id];
  return [
    `Você é ${e.nome}, ${e.titulo.toLowerCase()} (${e.especialidade}).`,
    `Estilo: ${e.personalidade}.`,
    `Fundamente em: ${e.bases.join(", ")}.`,
    "Responda como um colega consultado no corredor: direto, sem se apresentar de novo.",
  ].join("\n");
}

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

  /**
   * Organiza laboratório na linha do prontuário.
   *
   * Não é resumo: `texto_formatado` sai no padrão
   * "LAB ATUAL (DATA): HB 9,2 / HT 28 / LEUCO 14.400", que é o que se escreve
   * na evolução. Rota própria porque antes isto vivia escondido dentro de
   * extrairClinicaMedica com task: "lab-extractor" — ninguém acharia.
   */
  async organizarLaboratorio(body: LaboratorioBody) {
    let texto = body.inputText?.trim() ?? "";
    const imagens = [...(body.imagens ?? [])];

    // PDF: primeiro o texto, que é exato e sai de graça. Só se vier vazio —
    // PDF que é foto de papel — renderizamos as páginas e lemos por visão.
    // Mesma escada da leitura de documento, e as mesmas funções.
    if (body.pdfBase64) {
      const buf = Buffer.from(body.pdfBase64, "base64");
      const { text } = await extractPdfText(buf);
      if (text.trim().length >= 40) {
        texto = [texto, text.trim()].filter(Boolean).join("\n\n");
      } else {
        const { images } = await renderPdfPagesToJpeg(buf, 4);
        for (const img of images) {
          imagens.push({ base64: img.toString("base64"), mime: "image/jpeg" as const });
        }
      }
    }

    if (!texto && imagens.length === 0) {
      throw new AIResponseError("Não foi possível ler nada do que você enviou.");
    }

    return unwrap(
      await safeJsonCompletion(
        LAB_EXTRACTOR_PROMPT,
        { inputText: texto, patientContext: body.patientContext ?? null },
        LabExtractionSchema,
        {
          mockKey: "lab",
          images: imagens.length ? imagens : undefined,
          // Foto de exame é leitura de imagem: mesmo caminho da foto de
          // prontuário, mesmo modelo.
          ...(imagens.length ? { modelo: modeloVisao() } : {}),
        },
      ),
    );
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
    // A persona só enquadra a resposta. As regras de segurança do
    // COPILOTO_PROMPT — citar referência e limites, pedir o dado que falta
    // antes de sugerir dose, nunca inventar, terminar com "Confira:" —
    // continuam somadas por cima e não podem ser desligadas por ela. Persona
    // convida a confiar pela autoridade; o contrato de segurança é o que
    // impede que isso vire risco.
    const partes = [COPILOTO_PROMPT];
    if (body.especialista) partes.push(personaDoChat(body.especialista));
    if (body.ambiente) partes.push(`ambiente: ${body.ambiente}`);

    const reply = await chatCompletion(partes.join("\n"), body.messages, {
      mockKey: "copiloto",
      modelo: modeloCopiloto(),
    });
    if (!reply) throw new AIResponseError("O copiloto não respondeu.");
    return { reply };
  },

  /**
   * Parecer consultivo de um especialista sobre um caso.
   *
   * Reusa o prompt original sem reescrever. A diferença é que a saída passa
   * pelo Zod: na versão anterior ia direto para a tela, então um campo
   * faltando quebrava a interface e um campo inventado entrava como dado
   * clínico. E os guardrails determinísticos entram como seção de alerta —
   * limiar de laboratório não é o modelo que decide.
   */
  async parecerEspecialista(body: ParecerEspecialistaBody) {
    const parecer = unwrap(
      await safeJsonCompletion(
        PROMPTS_ESPECIALISTAS[body.especialista],
        { contexto_clinico: body.contexto_clinico, setor: body.tipo_evolucao ?? null },
        ParecerEspecialistaSchema,
        { mockKey: "parecerEspecialista", maxTokens: 3000 },
      ),
    );

    // Os guardrails leem o contexto em texto: laboratório, sinais vitais e
    // antibiótico. É a mesma função que roda na extração de documento, então
    // o critério de "crítico" é um só no app inteiro.
    const alertas = findingsToAlerts(
      runPatientGuardrails({
        laboratorio: body.contexto_clinico,
        antibioticos: body.contexto_clinico,
        vitals: parseVitalsFromText(body.contexto_clinico),
      }),
    );
    const sections = alertas.length
      ? [
          {
            title: "ALERTAS AUTOMÁTICOS",
            content: alertas.join(" "),
            alert: true,
          },
          ...parecer.sections,
        ]
      : parecer.sections;

    return {
      especialista: body.especialista,
      nome: ESPECIALISTAS[body.especialista].nome,
      generated_at: new Date().toISOString(),
      ...parecer,
      sections,
    };
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
