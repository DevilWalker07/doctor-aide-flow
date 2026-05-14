import { mockPatients } from "../mocks/clinicalMocks.js";

export const mockService = {
  patients: () => ({ patients: mockPatients, globalAlerts: ["MODO MOCK: OPENAI_API_KEY AUSENTE"] }),
  orquestrador: () => ({ agent: "orquestrador", patients: mockPatients, globalAlerts: ["MODO MOCK: OPENAI_API_KEY AUSENTE"], raw: { source: "mock" } }),
  lab: () => ({
    data_exame: new Date().toLocaleDateString("pt-BR"),
    tipo_exame: "LABORATÓRIO",
    valores: {},
    texto_formatado: "LAB ATUAL: MOCK - REVISAR TEXTO ORIGINAL.",
    eas_formatado: "",
    alertas: ["MODO MOCK"],
    valores_duvidosos: [],
    campos_nao_encontrados: [],
  }),
  evolution: () => ({ text: "EVOLUÇÃO MÉDICA\n\nDADOS NÃO REFERIDOS. REVISAR MANUALMENTE." }),
};
