import fs from "node:fs/promises";
import path from "node:path";
import { fileTypeFromFile } from "file-type";

export function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120);
}

export async function safeUnlink(filePath: string | undefined | null): Promise<void> {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch {
    /* already gone */
  }
}

export type SniffKind = "image" | "pdf" | "docx" | "text" | "unknown";

const TEXT_EXTS = new Set([".txt", ".md"]);

export async function sniffKind(filePath: string, originalName: string): Promise<SniffKind> {
  const ext = path.extname(originalName).toLowerCase();
  const detected = await fileTypeFromFile(filePath);

  if (detected) {
    if (detected.mime.startsWith("image/")) return "image";
    if (detected.mime === "application/pdf") return "pdf";
    if (detected.ext === "docx") return "docx";
    if (detected.ext === "zip" && ext === ".docx") return "docx";
    return "unknown";
  }

  if (TEXT_EXTS.has(ext)) {
    const handle = await fs.open(filePath, "r");
    try {
      const buf = Buffer.alloc(4096);
      const { bytesRead } = await handle.read(buf, 0, 4096, 0);
      const head = buf.subarray(0, bytesRead);
      if (hasUtf16Bom(head)) return "text";
      return head.includes(0) ? "unknown" : "text";
    } finally {
      await handle.close();
    }
  }
  return "unknown";
}

function hasUtf16Bom(buf: Buffer): boolean {
  return buf.length >= 2 && ((buf[0] === 0xff && buf[1] === 0xfe) || (buf[0] === 0xfe && buf[1] === 0xff));
}

export function decodeTextBuffer(buf: Buffer): string {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString("utf16le");
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.from(buf.subarray(2));
    swapped.swap16();
    return swapped.toString("utf16le");
  }
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.subarray(3).toString("utf-8");
  return buf.toString("utf-8");
}

export async function readTextFile(filePath: string): Promise<string> {
  return decodeTextBuffer(await fs.readFile(filePath));
}

export function extOf(originalName: string): string {
  return path.extname(originalName).toLowerCase().replace(".", "");
}
