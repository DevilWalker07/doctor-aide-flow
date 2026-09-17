/**
 * Anexos do laboratório: foto, print, arquivo e PDF.
 *
 * O caminho só-texto deixava de fora o jeito mais comum de receber resultado
 * no plantão — uma foto do papel ou um print da tela do sistema. Esta é a
 * mesma coleção de entradas que a tela antiga aceitava.
 *
 * As imagens são reduzidas **antes** de sair do aparelho: a função serverless
 * tem limite de corpo bem abaixo do tamanho de um print de celular, e enviar
 * 4 MB por 3G de hospital é lento sem ganho nenhum de leitura.
 */

const LADO_MAXIMO = 1800;
const QUALIDADE = 0.85;
const LIMITE_PDF_BYTES = 3 * 1024 * 1024;

export interface ImagemAnexo {
  base64: string;
  mime: "image/jpeg";
}

export type Anexo =
  | { tipo: "imagem"; nome: string; arquivo: File }
  | { tipo: "pdf"; nome: string; arquivo: File };

export function aceita(file: File): boolean {
  return file.type.startsWith("image/") || file.type === "application/pdf";
}

export function classificar(file: File): Anexo | null {
  if (file.type === "application/pdf") return { tipo: "pdf", nome: file.name, arquivo: file };
  if (file.type.startsWith("image/")) return { tipo: "imagem", nome: file.name, arquivo: file };
  return null;
}

/** Reduz para no máximo 1800 px no maior lado e devolve JPEG em base64. */
export async function reduzirImagem(file: File): Promise<ImagemAnexo> {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const largura = Math.max(1, Math.round(bitmap.width * escala));
  const altura = Math.max(1, Math.round(bitmap.height * escala));

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível preparar a imagem neste navegador.");
  // Fundo branco: print com transparência viraria preto no JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, largura, altura);
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", QUALIDADE);
  return { base64: dataUrl.split(",")[1] ?? "", mime: "image/jpeg" };
}

export async function pdfParaBase64(file: File): Promise<string> {
  if (file.size > LIMITE_PDF_BYTES) {
    throw new Error(
      `${file.name} tem ${(file.size / 1024 / 1024).toFixed(1)} MB. ` +
        "Para PDF grande, use Documentos — aqui o limite é 3 MB.",
    );
  }
  const buf = await file.arrayBuffer();
  let binario = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 8192) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(binario);
}

/** Arquivos de um input, de um drop ou de um Ctrl+V. */
export function arquivosDe(fonte: FileList | DataTransferItemList | null): File[] {
  if (!fonte) return [];
  const saida: File[] = [];
  for (let i = 0; i < fonte.length; i++) {
    const item = fonte[i];
    const file = item instanceof File ? item : (item as DataTransferItem).getAsFile?.();
    if (file && aceita(file)) saida.push(file);
  }
  return saida;
}
