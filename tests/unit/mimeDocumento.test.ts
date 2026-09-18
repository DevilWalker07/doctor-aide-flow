import { describe, expect, it } from "vitest";
import { mimeDoArquivo } from "../../src/lib/mimeDocumento.js";

/** Cria um File como o navegador entrega, com o `type` que ele decidiu dar. */
function arquivo(nome: string, type = ""): File {
  return new File([new Uint8Array([1, 2, 3])], nome, { type });
}

const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * O bucket `documentos-clinicos` tem `allowed_mime_types`. Mime fora da lista
 * é envio recusado — e recusado DEPOIS de o arquivo já ter subido, o que no
 * plantão parece o app travando sem motivo.
 */
describe("mime do arquivo enviado ao Storage", () => {
  it("docx sem type do navegador ainda sai com o mime certo", () => {
    // Este é o caso real: Chrome no Android e Safari no iPhone entregam .docx
    // com type vazio.
    expect(mimeDoArquivo(arquivo("L03 - GILBERTO.docx"))).toBe(MIME_DOCX);
  });

  it("nome com ponto no meio não confunde a extensão", () => {
    expect(mimeDoArquivo(arquivo("L04 - NARCISO BATISTA CRUZ. 24.08.docx"))).toBe(MIME_DOCX);
  });

  it("a extensão manda, mesmo quando o navegador diz octet-stream", () => {
    // octet-stream não está na lista do bucket: repassar isso é recusa.
    expect(mimeDoArquivo(arquivo("evolucao.pdf", "application/octet-stream"))).toBe(
      "application/pdf",
    );
  });

  it("maiúsculas na extensão funcionam", () => {
    expect(mimeDoArquivo(arquivo("EVOLUCAO.DOCX"))).toBe(MIME_DOCX);
  });

  it("txt, md e as imagens têm mime", () => {
    expect(mimeDoArquivo(arquivo("a.txt"))).toBe("text/plain");
    expect(mimeDoArquivo(arquivo("a.md"))).toBe("text/markdown");
    expect(mimeDoArquivo(arquivo("foto.jpeg"))).toBe("image/jpeg");
    expect(mimeDoArquivo(arquivo("print.png"))).toBe("image/png");
  });

  it("extensão desconhecida não inventa mime recusado", () => {
    expect(mimeDoArquivo(arquivo("arquivo.xyz", "application/octet-stream"))).toBeUndefined();
    expect(mimeDoArquivo(arquivo("sem-extensao"))).toBeUndefined();
  });

  it("extensão desconhecida com type aceito repassa o do navegador", () => {
    expect(mimeDoArquivo(arquivo("estranho", "application/pdf"))).toBe("application/pdf");
  });
});
