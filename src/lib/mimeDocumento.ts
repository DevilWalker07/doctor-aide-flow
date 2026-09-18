/**
 * Mime a declarar no envio ao Storage, deduzido da extensão.
 *
 * O bucket `documentos-clinicos` tem `allowed_mime_types`, e quem manda o
 * arquivo é o navegador. Só que `File.type` vem VAZIO com frequência para
 * .docx — no Chrome do Android, no Safari do iPhone e em PC quando o arquivo
 * chega de rede ou de um gerenciador que não reconhece a extensão. Com o campo
 * vazio o Supabase assume `application/octet-stream`, que não está na lista, e
 * o envio é recusado depois de já ter subido.
 *
 * Por isso a extensão manda aqui: ela é o que o médico controla. A checagem
 * por magic bytes continua no servidor (`server/lib/files.ts`) — lá extensão
 * não vale como prova, e é onde a prova importa.
 */
const POR_EXTENSAO: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

/** Mimes que o bucket aceita — declarar fora desta lista é envio recusado. */
const ACEITOS = new Set(Object.values(POR_EXTENSAO));

export function mimeDoArquivo(file: File): string | undefined {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const pelaExtensao = POR_EXTENSAO[ext];
  if (pelaExtensao) return pelaExtensao;

  // Extensão desconhecida: só repassa o que o navegador disse se o bucket
  // aceitar. Declarar um mime recusado falha mais tarde e mais confuso.
  const doNavegador = file.type?.trim();
  return doNavegador && ACEITOS.has(doNavegador) ? doNavegador : undefined;
}
