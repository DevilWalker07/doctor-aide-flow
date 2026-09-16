import fs from "node:fs/promises";
import { HttpError } from "../lib/errors.js";
import { extOf, readTextFile } from "../lib/files.js";
import { extractPdfText } from "./pdf.service.js";

export type TextKind = "txt" | "docx" | "pdf";

export interface ExtractedText {
  text: string;
  kind: TextKind;
  numPages?: number;
}

export async function extractTextFromFile(
  filePath: string,
  originalName: string,
): Promise<ExtractedText> {
  const ext = extOf(originalName);

  if (ext === "txt" || ext === "md") {
    return { text: await readTextFile(filePath), kind: "txt" };
  }

  if (ext === "docx") {
    const mammoth = (await import("mammoth")).default;
    const result = await mammoth.extractRawText({ path: filePath });
    return { text: result.value, kind: "docx" };
  }

  if (ext === "doc") {
    throw new HttpError(
      415,
      "unsupported_format",
      `${originalName}: formato .doc legado não suportado. Salve como .docx ou PDF.`,
    );
  }

  if (ext === "pdf") {
    const { text, numPages } = await extractPdfText(await fs.readFile(filePath));
    return { text, kind: "pdf", numPages };
  }

  throw new HttpError(
    415,
    "unsupported_format",
    `${originalName}: extensão .${ext} não suportada.`,
  );
}
