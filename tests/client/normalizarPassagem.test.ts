import { describe, expect, it, vi } from "vitest";
import { ArquivoNaoLido, normalizarArquivo } from "../../src/lib/passagem/normalizar";
import { gerarDocxFicticio } from "../fixtures/passagem/docxFicticio";

/**
 * O normalizador decide pelo conteúdo e só chama a IA onde não há texto.
 * Imagem e PDF escaneado precisam de canvas e ficam no e2e, num navegador de
 * verdade.
 */
const semIA = vi.fn(async () => {
  throw new Error("a IA não devia ser chamada");
});

describe("normalizador da passagem", () => {
  it("Word: cabeçalhos rotulados antes do corpo, sem IA", async () => {
    const bytes = await gerarDocxFicticio();
    const doc = await normalizarArquivo(new File([bytes], "L03-JOAQUIM.docx"), semIA);
    expect(doc.lidoDeImagem).toBe(false);
    expect(doc.markdown.startsWith("# CABEÇALHOS DO DOCUMENTO")).toBe(true);
    expect(doc.markdown).toContain("## Cabeçalho — primeira página");
    expect(doc.markdown).toContain("# CORPO DO DOCUMENTO");
    expect(doc.markdown).toContain("# LABORATÓRIO (25/09)");
    expect(doc.markdown).toContain("OBS: COM PACIENTE");
    expect(semIA).not.toHaveBeenCalled();
  });

  it("Word com nome .pdf é lido como Word e avisa", async () => {
    const bytes = await gerarDocxFicticio();
    const doc = await normalizarArquivo(new File([bytes], "L03 - JOAQUIM.pdf"), semIA);
    expect(doc.markdown).toContain("CABEÇALHOS DO DOCUMENTO");
    expect(doc.avisos[0]).toContain("o conteúdo é DOCX");
  });

  it("texto entra direto", async () => {
    const doc = await normalizarArquivo(new File(["EVOLUÇÃO MÉDICA\nESTÁVEL"], "l02.txt"), semIA);
    expect(doc.markdown).toBe("EVOLUÇÃO MÉDICA\nESTÁVEL");
  });

  it("Word antigo (.doc) pede para salvar como .docx", async () => {
    const ole = new Uint8Array([
      0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    await expect(normalizarArquivo(new File([ole], "x.doc"), semIA)).rejects.toThrow(
      /salve como \.docx/,
    );
  });

  it("formato desconhecido é recusado com o que aceitamos", async () => {
    const erro = await normalizarArquivo(new File(["{\\rtf1"], "x.rtf"), semIA).catch((e) => e);
    expect(erro).toBeInstanceOf(ArquivoNaoLido);
    expect(erro.message).toContain("Word (.docx), PDF, foto");
  });
});
