import { describe, expect, it } from "vitest";
import { BRIEFING_PROMPT } from "../../server/prompts/briefing.prompt.js";
import { CLINICA_MEDICA_PROMPT } from "../../server/prompts/clinicaMedica.prompt.js";
import { DOCUMENT_EXTRACTION_PROMPT } from "../../server/prompts/documentExtraction.prompt.js";
import { EVOLUTION_REVIEWER_PROMPT } from "../../server/prompts/evolutionReviewer.prompt.js";
import { GERADOR_ENCAMINHAMENTO_PROMPT } from "../../server/prompts/geradorEncaminhamento.prompt.js";
import { GERADOR_EVOLUCAO_PROMPT } from "../../server/prompts/geradorEvolucao.prompt.js";
import { LAB_EXTRACTOR_PROMPT } from "../../server/prompts/labExtractor.prompt.js";
import { MAPA_PLANTAO_PROMPT } from "../../server/prompts/mapaPlantao.prompt.js";
import { ORQUESTRADOR_PROMPT } from "../../server/prompts/orquestrador.prompt.js";
import { PASSAGEM_PLANTAO_BATCH_PROMPT } from "../../server/prompts/passagemPlantaoBatch.prompt.js";
import { PEDIATRIA_PROMPT } from "../../server/prompts/pediatria.prompt.js";
import { SUGESTOR_RECEITA_PROMPT } from "../../server/prompts/sugestorReceita.prompt.js";
import { UTI_PROMPT } from "../../server/prompts/uti.prompt.js";

const estimateTokens = (s: string) => Math.ceil(s.length / 3.5);

const BUDGET: Array<[string, string, number]> = [
  ["passagemPlantaoBatch", PASSAGEM_PLANTAO_BATCH_PROMPT, 3500],
  ["documentExtraction", DOCUMENT_EXTRACTION_PROMPT, 1500],
  ["clinicaMedica", CLINICA_MEDICA_PROMPT, 1200],
  ["pediatria", PEDIATRIA_PROMPT, 1200],
  ["uti", UTI_PROMPT, 1200],
  ["orquestrador", ORQUESTRADOR_PROMPT, 1300],
  ["geradorEvolucao", GERADOR_EVOLUCAO_PROMPT, 1200],
  ["mapaPlantao", MAPA_PLANTAO_PROMPT, 800],
  ["briefing", BRIEFING_PROMPT, 800],
  ["evolutionReviewer", EVOLUTION_REVIEWER_PROMPT, 800],
  ["geradorEncaminhamento", GERADOR_ENCAMINHAMENTO_PROMPT, 800],
  ["sugestorReceita", SUGESTOR_RECEITA_PROMPT, 800],
  ["labExtractor", LAB_EXTRACTOR_PROMPT, 800],
];

describe("orçamento de tokens dos prompts", () => {
  it.each(BUDGET)("%s cabe no orçamento", (_name, prompt, budget) => {
    expect(estimateTokens(prompt)).toBeLessThanOrEqual(budget);
  });

  it("prompts JSON pedem _raciocinio e trazem exemplo quando previsto", () => {
    for (const p of [PASSAGEM_PLANTAO_BATCH_PROMPT, DOCUMENT_EXTRACTION_PROMPT, CLINICA_MEDICA_PROMPT, PEDIATRIA_PROMPT, UTI_PROMPT, ORQUESTRADOR_PROMPT]) {
      expect(p).toContain("_raciocinio");
    }
    expect(PASSAGEM_PLANTAO_BATCH_PROMPT).toContain("### EXEMPLO SAÍDA");
    expect(DOCUMENT_EXTRACTION_PROMPT).toContain("### EXEMPLO SAÍDA");
    expect(PASSAGEM_PLANTAO_BATCH_PROMPT).toContain("Potássio < 3 ou > 5,5");
  });
});
