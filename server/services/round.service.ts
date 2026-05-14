export function gerarMapaPlantaoLocal(patients: any[], sector: string, date: string) {
  return [
    `PASSAGEM DE PLANTÃO ${String(sector || "CLÍNICA MÉDICA").toUpperCase()} - ${date}`,
    "",
    ...patients.flatMap((p) => [
      `${p.leito || p.bed} - ${p.nome || p.name} (${p.idade || p.age || "NÃO REFERIDO"} ANOS)`,
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

export function gerarBriefingLocal(patients: any[], sector: string, date: string) {
  return `BRIEFING DE PLANTÃO - ${String(sector || "CLÍNICA MÉDICA").toUpperCase()} - ${date}

CENSO DO PLANTÃO
- TOTAL DE PACIENTES: ${patients.length}

PACIENTES CRÍTICOS
${patients.filter((p) => p.alertas?.length).map((p) => `- ${p.leito || p.bed} ${p.nome || p.name}: ${p.alertas.join(", ")}`).join("\n") || "- SEM ALERTAS CRÍTICOS IDENTIFICADOS"}

PRIORIDADES DO ROUND
1. VER ALERTAS CRÍTICOS.
2. REVISAR ANTIBIÓTICOS E FUNÇÃO RENAL.
3. CHECAR PENDÊNCIAS DE ESPECIALIDADES.`.toUpperCase();
}
