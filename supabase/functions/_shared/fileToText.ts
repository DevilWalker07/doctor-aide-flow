// deno-lint-ignore-file no-explicit-any
/**
 * Extração de texto de arquivos sem chamada de IA.
 *
 * Substituto Deno-native pro MarkItDown (Python da Microsoft) pra evitar
 * container externo. Cobre os formatos mais comuns em hospital:
 *
 *   - PDF nativo (texto-puro)       → unpdf            (rápido, <100ms)
 *   - PDF scanneado / foto          → retorna null     (caller faz vision)
 *   - .docx                         → mammoth          (preserva tabelas)
 *   - .xlsx                         → SheetJS          (vira CSV)
 *   - imagem (jpg/png/heic/webp)    → retorna null     (caller faz vision)
 *   - texto puro                    → retorna direto
 *
 * Cache: SHA-256 do binário em public.file_extraction_cache. Dedup global
 * (mesmo arquivo subido N vezes = N hits, 1 extração).
 *
 * Caller tipico:
 *   const txt = await extractText({ fileBase64, fileType, fileName });
 *   if (txt) {
 *     // chama gpt-5 com texto (barato)
 *   } else {
 *     // fallback pra image_url / input_file (vision, caro mas funciona)
 *   }
 *
 * Pra desativar tudo e voltar 100% pra vision: setar EXTRACTOR_ENABLED=false
 * nos secrets da edge function.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface ExtractInput {
  fileBase64?: string;
  fileType?: string;
  fileName?: string;
}

export interface ExtractResult {
  text: string;
  extractor: "unpdf" | "mammoth" | "sheetjs" | "cache" | "plaintext";
  cached: boolean;
}

const ENABLED = Deno.env.get("EXTRACTOR_ENABLED") !== "false";

/**
 * Tenta extrair texto. Retorna null se:
 *  - Tipo não suportado (imagem, áudio, etc) — caller deve usar vision
 *  - Arquivo é PDF scanneado e unpdf não achou texto suficiente
 *  - Lib falhou (caller deve usar vision)
 */
export async function extractText(input: ExtractInput): Promise<ExtractResult | null> {
  if (!ENABLED) return null;
  if (!input.fileBase64 || !input.fileType) return null;

  const bytes = base64ToBytes(input.fileBase64);
  if (!bytes) return null;

  // 1. Cache lookup (SHA-256 do binário)
  const sha = await sha256Hex(bytes);
  const cached = await readCache(sha);
  if (cached) {
    // Não bloqueia caller pra atualizar contador
    bumpHitCount(sha).catch(() => {});
    return { text: cached.extracted_text, extractor: "cache", cached: true };
  }

  // 2. Dispatch por tipo
  let extracted: { text: string; extractor: ExtractResult["extractor"] } | null = null;
  try {
    if (input.fileType === "application/pdf") {
      extracted = await extractPdf(bytes);
    } else if (
      input.fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      input.fileType === "application/msword" ||
      input.fileName?.toLowerCase().endsWith(".docx")
    ) {
      extracted = await extractDocx(bytes);
    } else if (
      input.fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      input.fileType === "application/vnd.ms-excel" ||
      input.fileName?.toLowerCase().endsWith(".xlsx") ||
      input.fileName?.toLowerCase().endsWith(".xls")
    ) {
      extracted = await extractXlsx(bytes);
    } else if (input.fileType === "text/plain") {
      extracted = { text: new TextDecoder().decode(bytes), extractor: "plaintext" };
    }
  } catch (err) {
    console.warn("extractText falhou, vai fallback vision", err);
    return null;
  }

  if (!extracted || !extracted.text || extracted.text.trim().length < 20) {
    return null;
  }

  // 3. Salva no cache (fire-and-forget)
  writeCache({
    sha256: sha,
    mime_type: input.fileType,
    file_size: bytes.byteLength,
    extracted_text: extracted.text,
    extractor: extracted.extractor,
  }).catch((e) => console.warn("Cache write falhou", e));

  return { text: extracted.text, extractor: extracted.extractor, cached: false };
}

// ─── PDF ──────────────────────────────────────────────────────────────────

async function extractPdf(bytes: Uint8Array): Promise<{ text: string; extractor: "unpdf" } | null> {
  const { extractText: unpdfExtract } = await import("https://esm.sh/unpdf@0.12.1");
  const result = await unpdfExtract(bytes, { mergePages: true });
  const text = typeof result?.text === "string" ? result.text : Array.isArray(result?.text) ? result.text.join("\n\n") : "";
  if (!text || text.trim().length < 20) return null; // PDF scanneado provavelmente
  return { text, extractor: "unpdf" };
}

// ─── DOCX ─────────────────────────────────────────────────────────────────

async function extractDocx(bytes: Uint8Array): Promise<{ text: string; extractor: "mammoth" } | null> {
  // mammoth converte .docx -> markdown (preserva headings, listas, tabelas)
  const mammoth = await import("https://esm.sh/mammoth@1.8.0");
  const result = await mammoth.convertToMarkdown({ buffer: bytes });
  const text = result?.value || "";
  if (!text || text.trim().length < 20) return null;
  return { text, extractor: "mammoth" };
}

// ─── XLSX ─────────────────────────────────────────────────────────────────

async function extractXlsx(bytes: Uint8Array): Promise<{ text: string; extractor: "sheetjs" } | null> {
  const XLSX = await import("https://esm.sh/xlsx@0.18.5");
  const wb = XLSX.read(bytes, { type: "array" });
  const parts: string[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const csv = XLSX.utils.sheet_to_csv(ws);
    if (csv.trim()) {
      parts.push(`# ${name}\n\n${csv}`);
    }
  }
  const text = parts.join("\n\n");
  if (!text || text.trim().length < 20) return null;
  return { text, extractor: "sheetjs" };
}

// ─── Cache ────────────────────────────────────────────────────────────────

function getCacheClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anon) return null;
  return createClient(url, anon, { auth: { persistSession: false } });
}

async function readCache(sha: string): Promise<{ extracted_text: string } | null> {
  const sb = getCacheClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from("file_extraction_cache")
    .select("extracted_text")
    .eq("sha256", sha)
    .maybeSingle();
  if (error) {
    console.warn("Cache read error", error.message);
    return null;
  }
  return data ?? null;
}

async function writeCache(row: {
  sha256: string;
  mime_type: string;
  file_size: number;
  extracted_text: string;
  extractor: string;
}) {
  const sb = getCacheClient();
  if (!sb) return;
  await sb.from("file_extraction_cache").upsert(row, { onConflict: "sha256" });
}

async function bumpHitCount(sha: string) {
  const sb = getCacheClient();
  if (!sb) return;
  // Update direto sem RPC pra simplificar
  const { data } = await sb
    .from("file_extraction_cache")
    .select("hit_count")
    .eq("sha256", sha)
    .maybeSingle();
  const next = (data?.hit_count ?? 0) + 1;
  await sb
    .from("file_extraction_cache")
    .update({ hit_count: next, last_hit_at: new Date().toISOString() })
    .eq("sha256", sha);
}

// ─── Utils ────────────────────────────────────────────────────────────────

function base64ToBytes(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
