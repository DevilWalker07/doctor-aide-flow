import fs from "node:fs/promises";
import { HttpError } from "../lib/errors.js";
import { extOf, readTextFile, sniffKind } from "../lib/files.js";
import { extractPdfText } from "./pdf.service.js";

export type TextKind = "txt" | "docx" | "pdf";

export interface ExtractedText {
  text: string;
  kind: TextKind;
  numPages?: number;
  /**
   * Presente quando o nome do arquivo prometia um formato e os bytes eram
   * outro. Sobe até a tela: se os arquivos do hospital saem com extensão
   * errada, o médico fica sabendo em vez de descobrir por um erro obscuro.
   */
  aviso?: string;
}

const NOME_DO_FORMATO: Record<string, string> = {
  pdf: "PDF",
  docx: "Word",
  doc: "Word",
  txt: "texto",
  md: "texto",
};

function comoSeApresenta(ext: string): string {
  return NOME_DO_FORMATO[ext] ?? `.${ext}`;
}

async function lerDocx(filePath: string): Promise<string> {
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

/**
 * Extrai o texto decidindo pelo CONTEÚDO, não pela extensão.
 *
 * A rota de extração de documento já conferia por magic bytes
 * (`extract.routes.ts`), e o CLAUDE.md manda fazer isso porque "extensão
 * mente". Este caminho — o da passagem de plantão — despachava pelo nome, e o
 * resultado é o pior tipo de erro: um Word chamado `.pdf` ia para o leitor de
 * PDF e falhava reclamando da estrutura do PDF, sem nada ligando a mensagem à
 * causa real.
 *
 * A extensão continua valendo como pista para `.txt` e `.md`, que não têm
 * assinatura nos primeiros bytes — aí não há o que farejar.
 */
export async function extractTextFromFile(
  filePath: string,
  originalName: string,
): Promise<ExtractedText> {
  const ext = extOf(originalName);
  const conteudo = await sniffKind(filePath, originalName);

  const divergiu = (real: TextKind): string | undefined => {
    const prometido = comoSeApresenta(ext);
    const lido = comoSeApresenta(real);
    if (!ext || prometido === lido) return undefined;
    return `${originalName}: o nome diz ${prometido}, o conteúdo é ${lido}. Li como ${lido}.`;
  };

  if (conteudo === "pdf") {
    const { text, numPages } = await extractPdfText(await fs.readFile(filePath));
    return { text, kind: "pdf", numPages, aviso: divergiu("pdf") };
  }

  if (conteudo === "docx") {
    return { text: await lerDocx(filePath), kind: "docx", aviso: divergiu("docx") };
  }

  if (conteudo === "text") {
    return { text: await readTextFile(filePath), kind: "txt", aviso: divergiu("txt") };
  }

  // Conteúdo não identificado: a extensão volta a ser a melhor pista.
  if (ext === "txt" || ext === "md") {
    return { text: await readTextFile(filePath), kind: "txt" };
  }

  if (ext === "doc") {
    throw new HttpError(
      415,
      "unsupported_format",
      `${originalName}: formato .doc legado não suportado. Salve como .docx ou PDF.`,
    );
  }

  // Diz o que chegou E o que o nome prometia — sem isso o médico não tem como
  // saber se o problema é o arquivo ou o app.
  throw new HttpError(
    415,
    "unsupported_format",
    `${originalName}: não reconheci o conteúdo (o nome sugere ${comoSeApresenta(ext)}). ` +
      `Aceito PDF, Word (.docx) e texto.`,
  );
}
