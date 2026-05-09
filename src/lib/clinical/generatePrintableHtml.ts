import type { HandoffRow } from "./types";

const escapeHtml = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export function generateHandoffHtml(rows: HandoffRow[], title = "MAPA DE PASSAGEM DE PLANTÃO") {
  const tableRows = rows.map((row) => `
<tr>
<td><strong>${escapeHtml(row.patient)}</strong><br/>${escapeHtml(row.priority)}</td>
<td>${escapeHtml(row.problemList)}</td>
<td>${escapeHtml(row.medications)}</td>
<td>${escapeHtml(row.admissionReason)}</td>
<td>${escapeHtml(row.pendingAndWhatToEvaluate)}</td>
</tr>`).join("\n");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
@page { size: A4 landscape; margin: 7mm; }
body { font-family: Arial, sans-serif; font-size: 8.5px; color: #111; }
h1 { text-align: center; font-size: 14px; margin: 0 0 6px; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th, td { border: 1px solid #333; padding: 4px; vertical-align: top; word-wrap: break-word; }
th { background: #e8eef0; font-weight: bold; }
.footer { margin-top: 5px; font-size: 7px; text-align: right; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<table>
<thead><tr><th>PACIENTE</th><th>LISTA DE PROBLEMAS</th><th>MEDICAÇÕES EM USO</th><th>MOTIVO DA ADMISSÃO</th><th>PENDÊNCIAS / CONDUTAS / O QUE AVALIAR</th></tr></thead>
<tbody>${tableRows}</tbody>
</table>
<div class="footer">Documento gerado por IA. Revisão médica obrigatória.</div>
</body>
</html>`;
}
