import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { HttpError } from "./errors.js";
import { extOf, sanitizeFilename } from "./files.js";
import { getSupabaseAdmin } from "./supabaseAdmin.js";

export const BUCKET_DOCUMENTOS = "documentos-clinicos";

/** Extensões que a tela oferece e que o extrator sabe processar. */
const EXTENSOES_ACEITAS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif",
  "pdf",
  "docx",
  "txt",
  "md",
]);

const LIMITE_BYTES = 20 * 1024 * 1024;

/**
 * Valida que o caminho é do próprio usuário e não escapa da pasta dele.
 *
 * A policy do bucket já barra no banco, mas o backend usa a service role, que
 * ignora RLS — sem esta checagem, um `storage_path` forjado leria o documento
 * de outro médico. A defesa tem que estar aqui também.
 */
export function validarCaminho(storagePath: unknown, userId: string | null): string {
  if (typeof storagePath !== "string" || storagePath.trim() === "") {
    throw new HttpError(400, "missing_storage_path", "Informe o caminho do arquivo enviado.");
  }
  const caminho = storagePath.trim();

  if (caminho.includes("..") || caminho.startsWith("/")) {
    throw new HttpError(400, "invalid_storage_path", "Caminho de arquivo inválido.");
  }

  // Sem autenticação obrigatória (dev/testes) não há dono a conferir.
  if (userId) {
    const [pasta] = caminho.split("/");
    if (pasta !== userId) {
      throw new HttpError(403, "forbidden_path", "Este arquivo não pertence a você.");
    }
  }

  const ext = extOf(caminho);
  if (!EXTENSOES_ACEITAS.has(ext)) {
    throw new HttpError(
      415,
      "unsupported_format",
      `Arquivo não suportado: .${ext}. Use imagem, PDF, DOCX ou TXT.`,
    );
  }
  return caminho;
}

/** Caminho que o navegador deve usar ao enviar: sempre sob a pasta do médico. */
export function montarCaminho(userId: string, fileName: string): string {
  return `${userId}/${Date.now()}-${crypto.randomUUID()}-${sanitizeFilename(fileName)}`;
}

/**
 * Baixa o objeto do bucket para um arquivo temporário e devolve o caminho local.
 *
 * O extrator (`processFileInBackground`) trabalha com caminho de arquivo, e
 * continua trabalhando assim — por isso baixamos para `os.tmpdir()`, que é
 * gravável tanto no contêiner quanto na função da Vercel, em vez de reescrever
 * todo o pipeline para buffer.
 */
export async function baixarParaTemporario(
  storagePath: string,
): Promise<{ filePath: string; bytes: number }> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new HttpError(503, "storage_indisponivel", "Armazenamento de arquivos não configurado.");
  }

  const { data, error } = await admin.storage.from(BUCKET_DOCUMENTOS).download(storagePath);
  if (error || !data) {
    throw new HttpError(
      404,
      "arquivo_nao_encontrado",
      "Arquivo não encontrado no armazenamento. Envie novamente.",
    );
  }

  const buf = Buffer.from(await data.arrayBuffer());
  if (buf.byteLength === 0) {
    throw new HttpError(400, "arquivo_vazio", "O arquivo enviado está vazio.");
  }
  if (buf.byteLength > LIMITE_BYTES) {
    throw new HttpError(413, "arquivo_grande", "O arquivo deve ter no máximo 20 MB.");
  }

  const filePath = path.join(os.tmpdir(), `${crypto.randomUUID()}.${extOf(storagePath)}`);
  await fs.writeFile(filePath, buf);
  return { filePath, bytes: buf.byteLength };
}

/**
 * Apaga o objeto depois do processamento.
 *
 * Documento de paciente real não fica acumulando em bucket — o que o app
 * precisa é do resultado da extração, não do arquivo.
 */
export async function apagarDoBucket(storagePath: string): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  const { error } = await admin.storage.from(BUCKET_DOCUMENTOS).remove([storagePath]);
  if (error) console.warn(`[storage] não removeu ${storagePath}:`, error.message);
}
