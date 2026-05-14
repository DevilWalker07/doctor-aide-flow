import type { LabExtractionResult } from "../types/lab";
import type { ImportedRoundPatient } from "../types/round";

export function fallbackLabExtraction(text: string): LabExtractionResult {
  const hoje = new Date().toLocaleDateString("pt-BR");
  const upper = text.toUpperCase();
  const valores: Record<string, string | null> = {};
  const read = (key: string, regex: RegExp) => {
    const match = upper.match(regex);
    valores[key] = match?.[1]?.replace(".", ",") || null;
    return valores[key];
  };
  read("hb", /(?:HB|HEMOGLOBINA)[:\s]*(\d+[.,]?\d*)/i);
  read("ht", /(?:HT|HEMAT[OÓ]CRITO)[:\s]*(\d+[.,]?\d*)/i);
  read("leucocitos", /(?:LEUCO|LEUC[OÓ]CITOS?)[:\s]*(\d+[.,]?\d*)/i);
  read("creatinina", /(?:CR|CREATININA)[:\s]*(\d+[.,]?\d*)/i);
  read("pcr", /(?:PCR|PROTE[IÍ]NA C REATIVA)[:\s]*(\d+[.,]?\d*)/i);
  const texto = `LAB ATUAL (${hoje}): HB ${valores.hb || "NÃO REFERIDO"} / HT ${valores.ht || "NÃO REFERIDO"} / LEUCO ${valores.leucocitos || "NÃO REFERIDO"} / CR ${valores.creatinina || "NÃO REFERIDO"} / PCR ${valores.pcr || "NÃO REFERIDO"}`;
  return { data_exame: hoje, tipo_exame: "LABORATÓRIO", valores, texto_formatado: texto, alertas: [], valores_duvidosos: [], campos_nao_encontrados: [] };
}

export function gerarMapaPassagemPlantao(pacientes: ImportedRoundPatient[], setor: string, data: string): string {
  return [
    `PASSAGEM DE PLANTÃO ${setor.toUpperCase()} - ${data}`,
    "",
    ...pacientes.flatMap((p) => [
      `${p.leito} - ${p.nome} (${p.idade} ANOS)`,
      `Diagnóstico/Comorbidades: ${[p.diagnosticos, p.comorbidades].filter(Boolean).join(" / ") || "NÃO REFERIDO"}`,
      `Dispositivos: ${p.dispositivos || "NÃO REFERIDO"}`,
      `Antibiótico: ${p.antibioticos || "NÃO REFERIDO"}`,
      `Laboratório: ${p.laboratorio || "NÃO REFERIDO"}`,
      `Quadro Atual: ${p.quadro || "NÃO REFERIDO"}`,
      `Intercorrências: ${p.intercorrencias || "NÃO REFERIDO"}`,
      `Pendências: ${p.pendencias || "NÃO REFERIDO"}`,
      `Alertas: ${p.alertas?.length ? p.alertas.join("; ") : "SEM ALERTAS"}`,
      "",
    ]),
  ].join("\n").toUpperCase();
}

export function gerarBriefingLocal(pacientes: ImportedRoundPatient[], setor: string, data: string): string {
  const alertas = pacientes.filter((p) => p.alertas.length);
  return [
    `BRIEFING DE PLANTÃO - ${setor.toUpperCase()} - ${data}`,
    "",
    "CENSO DO PLANTÃO",
    `- TOTAL DE PACIENTES: ${pacientes.length}`,
    "",
    "PACIENTES CRÍTICOS",
    ...(alertas.length ? alertas.map((p) => `- ${p.leito} ${p.nome}: ${p.alertas.join(", ")}`) : ["- SEM ALERTAS CRÍTICOS IDENTIFICADOS"]),
    "",
    "RISCO DE ASPIRAÇÃO",
    ...pacientes.filter((p) => /ASPIRA|ENGASGO|VÔMIT/i.test(`${p.alertas.join(" ")} ${p.quadro}`)).map((p) => `- ${p.leito} ${p.nome}`),
    "",
    "ALERTAS INFECCIOSOS",
    ...pacientes.filter((p) => /PCR|ATB|ANTIB|INFEC/i.test(`${p.laboratorio} ${p.antibioticos}`)).map((p) => `- ${p.leito} ${p.nome}: ${p.antibioticos}`),
    "",
    "ALERTAS RENAIS",
    ...pacientes.filter((p) => /RENAL|DRC|CR |CREAT/i.test(`${p.alertas.join(" ")} ${p.laboratorio}`)).map((p) => `- ${p.leito} ${p.nome}: ${p.laboratorio}`),
    "",
    "PENDÊNCIAS DE ESPECIALIDADES",
    ...pacientes.filter((p) => /FONO|PSIQ|NEFRO|ENDO|PARECER|RNM/i.test(p.pendencias)).map((p) => `- ${p.leito} ${p.nome}: ${p.pendencias}`),
    "",
    "ALTAS PROVÁVEIS",
    "- REVISAR NO ROUND.",
    "",
    "PRIORIDADES DO ROUND",
    "1. VER ALERTAS CRÍTICOS.",
    "2. REVISAR ANTIBIÓTICOS E FUNÇÃO RENAL.",
    "3. CHECAR PENDÊNCIAS DE ALTA/PROCEDIMENTO.",
  ].join("\n").toUpperCase();
}

export function fallbackEvolution(payload: any): string {
  const p = payload?.patient || payload || {};
  const data = p.data || payload?.data || {};
  return `EVOLUÇÃO MÉDICA

#LISTA DE PROBLEMAS:
[ATIVOS]
1. ${data?.conducta?.dx || p.hda || "NÃO REFERIDO"}
[RESOLVIDOS]
1. NÃO REFERIDO

#EVOLUÇÃO DIÁRIA:
${payload?.previa || "NÃO REFERIDO"}

#EXAME FÍSICO:
ECT: ${data?.exam?.ect || "NÃO REFERIDO"}
ACV: ${data?.exam?.acv || "NÃO REFERIDO"}
AR: ${data?.exam?.ar || "NÃO REFERIDO"}
ABD: ${data?.exam?.abd || "NÃO REFERIDO"}
EXT: ${data?.exam?.ext || "NÃO REFERIDO"}

CONDUTAS:
${data?.conducta?.condutas || "NÃO REFERIDO"}

PENDÊNCIAS:
${data?.conducta?.pendencias || "NÃO REFERIDO"}

INTERCORRÊNCIAS:
${data?.conducta?.intercorrencias || "NÃO REFERIDO"}`.toUpperCase();
}
