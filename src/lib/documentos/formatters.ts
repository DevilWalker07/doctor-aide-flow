import { HORARIOS, type Horario } from "@/lib/medical/medicamentos";
import { getOrientacao } from "@/lib/medical/orientacoes";
import type { EncaminhamentoDocumento, MedicoDocumento, OrientacoesDocumento, ReceitaDocumento, ReceitaItem } from "./types";

const UNIDADE_POR_ACAO: Record<ReceitaItem["acao"], [string, string]> = {
  comprimido: ["comprimido", "comprimidos"],
  gotas: ["dose", "doses"],
  injecao: ["aplicação", "aplicações"],
  inalacao: ["jato", "jatos"],
  topico: ["aplicação", "aplicações"],
  oftalmico: ["gota", "gotas"],
};

export function unidadeLabel(acao: ReceitaItem["acao"], n: number): string {
  const [sing, plu] = UNIDADE_POR_ACAO[acao];
  return `${n} ${n === 1 ? sing : plu}`;
}

export function horariosAtivos(horarios: Partial<Record<Horario, number>>) {
  return HORARIOS.filter((h) => (horarios[h.id] ?? 0) > 0).map((h) => ({ ...h, n: horarios[h.id] as number }));
}

function cabecalhoMedico(medico: MedicoDocumento) {
  const crm = medico.crm ? ` (CRM ${medico.crm})` : "";
  return `Dr(a). ${medico.nome}${crm}`;
}

function linhaPaciente(nome: string, idade?: string) {
  return `👤 Paciente: ${nome || "—"}${idade ? `, ${idade} anos` : ""}`;
}

export function formatReceitaWhatsApp(doc: ReceitaDocumento, medico: MedicoDocumento): string {
  const linhas: string[] = [`💊 *RECEITA MÉDICA* — ${cabecalhoMedico(medico)}`, linhaPaciente(doc.paciente.nome, doc.paciente.idade), `📅 ${doc.data}`, ""];

  doc.itens.forEach((item, i) => {
    linhas.push(`*${i + 1}. ${item.nome} ${item.dose}* — ${item.quantidade}`);
    const ativos = horariosAtivos(item.horarios);
    if (ativos.length) {
      linhas.push(ativos.map((h) => `${h.emoji} ${h.label}: ${unidadeLabel(item.acao, h.n)}`).join("  |  "));
    }
    if (item.instrucao) linhas.push(`📝 ${item.instrucao}`);
    if (item.duracao) linhas.push(`⏳ ${item.duracao}`);
    if (item.observacao) linhas.push(`ℹ️ ${item.observacao}`);
    if (item.farmaciaPopular) linhas.push("🏥 Disponível na Farmácia Popular");
    if (item.controlado) linhas.push(`🔒 Receita controlada (${item.controlado})`);
    linhas.push("");
  });

  if (doc.observacoes.trim()) linhas.push(`📌 ${doc.observacoes.trim()}`, "");
  linhas.push("_Em caso de dúvida, procure a UBS ou o médico._");
  return linhas.join("\n").trim();
}

export function formatEncaminhamentoWhatsApp(doc: EncaminhamentoDocumento, medico: MedicoDocumento): string {
  return [`📄 *ENCAMINHAMENTO MÉDICO* — ${cabecalhoMedico(medico)}`, "", doc.texto.trim(), "", `✍️ ${cabecalhoMedico(medico)}${medico.hospital ? ` — ${medico.hospital}` : ""}`].join("\n");
}

export function formatOrientacoesWhatsApp(doc: OrientacoesDocumento, medico: MedicoDocumento): string {
  const linhas: string[] = [`📋 *ORIENTAÇÕES AO PACIENTE* — ${cabecalhoMedico(medico)}`, linhaPaciente(doc.paciente.nome, doc.paciente.idade), `📅 ${doc.data}`, ""];

  for (const id of doc.orientacaoIds) {
    const o = getOrientacao(id);
    if (!o) continue;
    linhas.push(`*${o.titulo.toUpperCase()}*`);
    o.itens.forEach((i) => linhas.push(`✅ ${i}`));
    if (o.sinaisAlerta.length) {
      linhas.push("", "⚠️ *Procure atendimento se:*");
      o.sinaisAlerta.forEach((s) => linhas.push(`🚨 ${s}`));
    }
    linhas.push("");
  }

  if (doc.extras.length) {
    linhas.push("*OUTRAS ORIENTAÇÕES*");
    doc.extras.forEach((e) => linhas.push(`✅ ${e}`));
    linhas.push("");
  }
  if (doc.retorno.trim()) linhas.push(`🗓️ *Retorno:* ${doc.retorno.trim()}`, "");
  linhas.push("_Guarde este texto e mostre para a família._");
  return linhas.join("\n").trim();
}

export function formatReceitaTextoPlano(doc: ReceitaDocumento, medico: MedicoDocumento): string {
  return formatReceitaWhatsApp(doc, medico).replace(/[*_]/g, "");
}
