import { describe, expect, it } from "vitest";
import { avisoDeExtensao, formatoPelosBytes } from "../../../shared/passagem/formato.js";

const b = (...xs: number[]) => new Uint8Array(xs);
const s = (t: string) => new TextEncoder().encode(t);

describe("formato pelos bytes", () => {
  it.each([
    ["docx", b(0x50, 0x4b, 0x03, 0x04), "x.pdf"],
    ["pdf", s("%PDF-1.7"), "x.docx"],
    ["doc", b(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1), "x.doc"],
    ["jpeg", b(0xff, 0xd8, 0xff, 0xe0), "foto"],
    ["png", b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), "x.png"],
    ["webp", s("RIFF\0\0\0\0WEBP"), "x.webp"],
    ["heic", s("\0\0\0\x18ftypheic"), "IMG_0001.HEIC"],
    ["texto", s("EVOLUÇÃO"), "x.txt"],
    ["desconhecido", s("EVOLUÇÃO"), "x.rtf"],
  ])("%s", (esperado, bytes, nome) => {
    expect(formatoPelosBytes(bytes, nome)).toBe(esperado);
  });

  it("Word chamado .pdf é lido como Word, com aviso", () => {
    expect(avisoDeExtensao("docx", "L04 - NARCISO.pdf")).toContain("o conteúdo é DOCX");
    expect(avisoDeExtensao("jpeg", "foto.JPG")).toBeNull();
    expect(avisoDeExtensao("jpeg", "sem-extensao")).toBeNull();
  });
});
