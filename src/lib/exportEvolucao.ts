import { VITE_CLINICAL_AGENTS_URL } from "./clinicalAgentsConfig";

const BACKEND_URL = VITE_CLINICAL_AGENTS_URL.replace(/\/$/, "");

export type ExportFormat = "docx" | "pdf" | "txt";

export interface ExportHeader {
  hospital?: string;
  medico?: string;
  crm?: string;
  paciente?: string;
  leito?: string;
  data?: string;
  tipo?: string;
}

export async function exportEvolucao(opts: {
  text: string;
  format: ExportFormat;
  header?: ExportHeader;
  filename_hint?: string;
}): Promise<void> {
  return exportTextoMedico(opts);
}

export async function exportTextoMedico(opts: {
  text: string;
  format: ExportFormat;
  header?: ExportHeader;
  filename_hint?: string;
}): Promise<void> {
  if (!BACKEND_URL) throw new Error("Backend de IA não configurado.");

  // TXT pode ser gerado client-side, sem rede — mais rápido e funciona offline.
  if (opts.format === "txt") {
    const h = opts.header || {};
    const headerLines: string[] = [];
    const right = [h.medico, h.crm ? `CRM ${h.crm}` : ""].filter(Boolean).join(" — ");
    if (h.hospital || right) headerLines.push(`${h.hospital || ""}    ${right}`.trim(), "");
    headerLines.push((h.tipo || "EVOLUÇÃO MÉDICA").toUpperCase());
    const meta = [
      h.paciente ? `PACIENTE: ${h.paciente}` : "",
      h.leito ? `LEITO: ${h.leito}` : "",
      h.data ? `DATA: ${h.data}` : "",
    ].filter(Boolean).join("  ·  ");
    if (meta) headerLines.push(meta);
    headerLines.push("─".repeat(80), "");
    const body = headerLines.join("\n") + opts.text;
    downloadBlob(new Blob([body], { type: "text/plain;charset=utf-8" }), filename(opts) + ".txt");
    return;
  }

  const response = await fetch(`${BACKEND_URL}/api/export/evolucao`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: opts.text,
      format: opts.format,
      header: opts.header || {},
      filename_hint: opts.filename_hint,
    }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.detail || `Erro ao exportar (${response.status}).`);
  }
  const blob = await response.blob();
  downloadBlob(blob, filename(opts) + "." + opts.format);
}

function filename(opts: { header?: ExportHeader; filename_hint?: string }): string {
  const raw = (opts.filename_hint || opts.header?.paciente || "evolucao").toString();
  return raw.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "evolucao";
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
