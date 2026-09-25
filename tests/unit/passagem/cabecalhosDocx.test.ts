import { describe, expect, it } from "vitest";
import {
  cabecalhosEmMarkdown,
  lerCabecalhosDocx,
  textoDoXmlWord,
} from "../../../shared/passagem/cabecalhosDocx.js";
import { gerarDocxFicticio } from "../../fixtures/passagem/docxFicticio.js";

describe("cabeçalhos do Word", () => {
  it("lê os DOIS cabeçalhos divergentes, primeira página antes das demais", async () => {
    const cabecalhos = await lerCabecalhosDocx(await gerarDocxFicticio());
    expect(cabecalhos.map((c) => c.rotulo)).toEqual(["primeira página", "demais páginas"]);
    const [primeira, demais] = cabecalhos.map((c) => c.linhas.join("\n"));
    expect(primeira).toContain("HOSPITAL FICTÍCIO NAIR");
    expect(primeira).toContain("DATA: 25/09/2026");
    expect(demais).toContain("UNIDADE DE PRONTO ATENDIMENTO FICTÍCIA");
    expect(demais).toContain("24/09/2026");
  });

  it("células da mesma linha da tabela saem juntas, separadas por |", async () => {
    const [primeira] = await lerCabecalhosDocx(await gerarDocxFicticio({ leito: "07" }));
    expect(primeira.linhas).toContain("UNIDADE DE INTERNAÇÃO: HFN | LEITO: 07");
    expect(primeira.linhas).toContain("DATA DA ADMISSÃO: 20/09/2026 | Nº DE PRONTUÁRIO: | 000123");
  });

  it("o Markdown traz cada cabeçalho rotulado", async () => {
    const md = cabecalhosEmMarkdown(await lerCabecalhosDocx(await gerarDocxFicticio()));
    expect(md.startsWith("# CABEÇALHOS DO DOCUMENTO")).toBe(true);
    expect(md).toContain("## Cabeçalho — primeira página");
    expect(md).toContain("## Cabeçalho — demais páginas");
    expect(md.indexOf("primeira página")).toBeLessThan(md.indexOf("demais páginas"));
  });

  it("posições de tabulação do parágrafo não viram texto", () => {
    const xml =
      '<w:hdr><w:p><w:pPr><w:tabs><w:tab w:val="center" w:pos="4252"/></w:tabs></w:pPr>' +
      "<w:r><w:t>NOME:</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>FULANO &amp; CIA</w:t></w:r></w:p></w:hdr>";
    expect(textoDoXmlWord(xml)).toEqual(["NOME: FULANO & CIA"]);
  });

  it("arquivo que não é Word → erro, não lista vazia disfarçada", async () => {
    await expect(lerCabecalhosDocx(new TextEncoder().encode("não é zip"))).rejects.toThrow();
  });
});
