/**
 * Registro da RCP para o prontuário: texto para copiar e PDF para baixar,
 * imprimir ou anexar. Cada evento sai com a hora do relógio e o tempo
 * decorrido desde o início.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { descreverIdade, formatarNumero } from "../../../shared/pediatria/calculos";
import { DROGAS_BOLUS } from "../../../shared/pediatria/drogas";
import { DROGAS_EXTRAS } from "../../../shared/pediatria/kits";
import { formatarTempo } from "../../../shared/pediatria/pcr";
import { PAPEIS, type SessaoRcp } from "./sessaoRcp";

const hora = (ms: number) =>
  new Date(ms).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
const data = (ms: number) => new Date(ms).toLocaleDateString("pt-BR");

const nomeDroga = (id: string) => {
  const d = [...DROGAS_BOLUS, ...DROGAS_EXTRAS].find((x) => x.id === id);
  return d ? `${d.nome} (${d.via})` : id;
};

export function desfecho(s: SessaoRcp): string {
  if (!s.fim) return "Em andamento";
  return s.fim.resultado === "rce" ? "Retorno da circulação espontânea (RCE)" : "Encerrada sem RCE";
}

export function duracao(s: SessaoRcp, agora: number): number {
  return (s.fim?.em ?? agora) - s.inicio;
}

export function textoRegistro(s: SessaoRcp, agora: number): string {
  const p = s.paciente;
  const linhas = [
    `RCP pediátrica — ${data(s.inicio)}, início ${hora(s.inicio)}`,
    p
      ? `Paciente: ${formatarNumero(p.peso, 1)} kg${p.pesoEstimado ? " (estimado)" : ""}${p.idade ? `, ${descreverIdade(p.idade)}` : ""}`
      : "Paciente: peso não informado",
  ];
  const equipe = PAPEIS.filter((r) => s.equipe[r.id].trim()).map(
    (r) => `${r.rotulo}: ${s.equipe[r.id].trim()}`,
  );
  if (equipe.length) linhas.push(`Equipe — ${equipe.join("; ")}`);
  linhas.push("");
  for (const e of s.eventos)
    linhas.push(`${hora(s.inicio + e.t)}  (${formatarTempo(e.t)})  ${e.texto}`);
  linhas.push("");
  linhas.push(
    `Duração: ${formatarTempo(duracao(s, agora))} · ${s.choques} choque(s) · ${s.adrenalinas} adrenalina(s) · ${s.amiodaronas} amiodarona(s)`,
  );
  linhas.push(`Desfecho: ${desfecho(s)}`);
  return linhas.join("\n");
}

export function nomeArquivoRelatorio(s: SessaoRcp): string {
  const d = new Date(s.inicio);
  const z = (n: number) => String(n).padStart(2, "0");
  return `rcp-pediatrica_${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}_${z(d.getHours())}h${z(d.getMinutes())}.pdf`;
}

export function gerarRelatorioPdf(s: SessaoRcp, agora: number): jsPDF {
  const doc = new jsPDF("portrait", "mm", "a4");
  const L = 14;
  const largura = doc.internal.pageSize.getWidth() - 2 * L;
  let y = 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Registro de RCP pediátrica", L, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(
    `${data(s.inicio)} · início ${hora(s.inicio)}${s.fim ? ` · fim ${hora(s.fim.em)}` : ""} · duração ${formatarTempo(duracao(s, agora))}`,
    L,
    y,
  );
  doc.setTextColor(0);
  y += 4;

  const p = s.paciente;
  const resumo: [string, string][] = [
    ["Desfecho", desfecho(s)],
    [
      "Paciente",
      p
        ? `${formatarNumero(p.peso, 1)} kg${p.pesoEstimado ? " (estimado pela idade)" : ""}${p.idade ? ` · ${descreverIdade(p.idade)}` : ""}`
        : "Peso não informado",
    ],
    ["Choques", String(s.choques)],
    ["Adrenalina", `${s.adrenalinas} dose(s)`],
    ["Amiodarona", `${s.amiodaronas} dose(s)`],
  ];
  const outras = Object.entries(s.registros).filter(([, n]) => n > 0);
  if (outras.length)
    resumo.push(["Outras drogas", outras.map(([id, n]) => `${nomeDroga(id)} ${n}×`).join("; ")]);
  if (s.causas.length) resumo.push(["Hipóteses (Hs e Ts)", s.causas.join("; ")]);

  autoTable(doc, {
    startY: y,
    body: resumo,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 1.4 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 38 } },
    margin: { left: L, right: L },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  const equipe = PAPEIS.map((r) => [r.rotulo, s.equipe[r.id].trim() || "—"]);
  autoTable(doc, {
    startY: y,
    head: [["Equipe", "Nome"]],
    body: equipe,
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 1.6 },
    headStyles: { fillColor: [11, 31, 68] },
    columnStyles: { 0: { cellWidth: 38 } },
    margin: { left: L, right: L },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  autoTable(doc, {
    startY: y,
    head: [["Hora", "Tempo", "Evento"]],
    body: s.eventos.map((e) => [hora(s.inicio + e.t), formatarTempo(e.t), e.texto]),
    theme: "striped",
    styles: { fontSize: 9.5, cellPadding: 1.6 },
    headStyles: { fillColor: [11, 31, 68] },
    columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: 16 } },
    margin: { left: L, right: L },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14;

  if (y > doc.internal.pageSize.getHeight() - 30) {
    doc.addPage();
    y = 30;
  }
  doc.setFontSize(10);
  doc.line(L, y, L + largura / 2 - 6, y);
  doc.line(L + largura / 2 + 6, y, L + largura, y);
  doc.text("Médico responsável", L, y + 5);
  doc.text("CRM", L + largura / 2 + 6, y + 5);

  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `Gerado pelo Medfluxo em ${data(agora)} ${hora(agora)} — ferramenta de apoio; conferir antes de anexar ao prontuário.`,
      L,
      doc.internal.pageSize.getHeight() - 8,
    );
    doc.text(`${i}/${paginas}`, L + largura, doc.internal.pageSize.getHeight() - 8, {
      align: "right",
    });
    doc.setTextColor(0);
  }
  return doc;
}

export function baixarRelatorioPdf(s: SessaoRcp, agora: number): void {
  gerarRelatorioPdf(s, agora).save(nomeArquivoRelatorio(s));
}
