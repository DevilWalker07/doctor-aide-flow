import { BRIEFING_PROMPT } from "../prompts/briefing.prompt.js";
import { CLINICA_MEDICA_PROMPT } from "../prompts/clinicaMedica.prompt.js";
import { GERADOR_EVOLUCAO_PROMPT } from "../prompts/geradorEvolucao.prompt.js";
import { MAPA_PLANTAO_PROMPT } from "../prompts/mapaPlantao.prompt.js";
import { ORQUESTRADOR_PROMPT } from "../prompts/orquestrador.prompt.js";
import { PEDIATRIA_PROMPT } from "../prompts/pediatria.prompt.js";
import { UTI_PROMPT } from "../prompts/uti.prompt.js";
import { jsonCompletion, textCompletion } from "./openaiClient.js";
import { mockService } from "./mock.service.js";
import { gerarBriefingLocal, gerarMapaPlantaoLocal } from "./round.service.js";

function normalizePatients(ai: any) {
  if (!ai?.patients?.length) return mockService.patients();
  return { patients: ai.patients, globalAlerts: ai.globalAlerts || [] };
}

export const motorLuanService = {
  async orquestrador(body: unknown) {
    const ai = await jsonCompletion(ORQUESTRADOR_PROMPT, body);
    return ai || mockService.orquestrador();
  },

  async extrairClinicaMedica(body: any) {
    if (body?.task === "lab-extractor") {
      const ai = await jsonCompletion(CLINICA_MEDICA_PROMPT, body);
      return ai || mockService.lab();
    }
    return normalizePatients(await jsonCompletion(CLINICA_MEDICA_PROMPT, body));
  },

  async extrairPediatria(body: unknown) {
    return normalizePatients(await jsonCompletion(PEDIATRIA_PROMPT, body));
  },

  async extrairUti(body: unknown) {
    return normalizePatients(await jsonCompletion(UTI_PROMPT, body));
  },

  async gerarEvolucao(body: unknown) {
    const text = await textCompletion(GERADOR_EVOLUCAO_PROMPT, body);
    return text ? { text: text.toUpperCase() } : mockService.evolution();
  },

  async importarEvolucoesOntem(body: unknown) {
    return normalizePatients(await jsonCompletion(CLINICA_MEDICA_PROMPT, body));
  },

  async gerarMapaPlantao(body: any) {
    const text = await textCompletion(MAPA_PLANTAO_PROMPT, body);
    return { text: text || gerarMapaPlantaoLocal(body.patients || [], body.sector, body.date) };
  },

  async gerarBriefing(body: any) {
    const text = await textCompletion(BRIEFING_PROMPT, body);
    return { text: text || gerarBriefingLocal(body.patients || [], body.sector, body.date) };
  },
};
