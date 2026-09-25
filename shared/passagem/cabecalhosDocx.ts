import JSZip from "jszip";

/**
 * Lê os cabeçalhos de um `.docx`, rotulados pelo lugar onde aparecem.
 *
 * A identificação do paciente (nome, leito, DIH, prontuário, unidade) mora no
 * cabeçalho do Word — e o `mammoth` ignora cabeçalho e rodapé. Sem isto o
 * documento chega à IA sem nome nem leito.
 *
 * E um documento costuma ter MAIS DE UM cabeçalho, que divergem: nos arquivos
 * reais, a primeira página traz "HOSPITAL NAIR ALVES DE SOUZA, 19/09" e as
 * demais páginas "UNIDADE DE PRONTO ATENDIMENTO, 18/09" — sobra do modelo de
 * onde o documento foi copiado. Por isso cada cabeçalho sai com o seu rótulo:
 * quem escolhe o certo é a IA, pela regra do prompt, e ela precisa saber qual
 * é qual.
 */
export interface CabecalhoDocx {
  /** "primeira página", "demais páginas", "páginas pares", com a seção quando há mais de uma. */
  rotulo: string;
  linhas: string[];
}

const ROTULO_TIPO: Record<string, string> = {
  first: "primeira página",
  default: "demais páginas",
  even: "páginas pares",
};

function decodificar(texto: string): string {
  return texto
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

/**
 * Texto de um XML do WordprocessingML, linha por linha.
 *
 * Propriedades de parágrafo e de run saem antes: o `<w:tabs>` do `<w:pPr>`
 * declara posições de tabulação com o mesmo nome de elemento (`<w:tab .../>`)
 * que o caractere de tabulação — contá-lo como texto enche o cabeçalho de
 * lixo. Células da mesma linha de tabela saem juntas, separadas por " | ",
 * que é como o cabeçalho do hospital é montado (rótulo e valor em células
 * vizinhas).
 */
export function textoDoXmlWord(xml: string): string[] {
  const limpo = xml
    .replace(/<w:pPr>[\s\S]*?<\/w:pPr>/g, "")
    .replace(/<w:rPr>[\s\S]*?<\/w:rPr>/g, "")
    .replace(/<w:instrText[\s\S]*?<\/w:instrText>/g, "");

  const linhas: string[] = [];
  let paragrafo = "";
  let celulas: string[] | null = null;
  let celula = "";

  const fecharParagrafo = () => {
    const t = paragrafo.replace(/[ \t]+/g, " ").trim();
    paragrafo = "";
    if (!t) return;
    if (celulas) celula = celula ? `${celula} ${t}` : t;
    else linhas.push(t);
  };

  const token = /<(\/?)(w:p|w:t|w:tab|w:br|w:tr|w:tc)\b[^>]*?(\/?)>|([^<]+)/g;
  let dentroDeTexto = false;
  for (const m of limpo.matchAll(token)) {
    const [, fecha, tag, autoFecha, texto] = m;
    if (texto !== undefined) {
      if (dentroDeTexto) paragrafo += decodificar(texto);
      continue;
    }
    if (tag === "w:t") {
      dentroDeTexto = !fecha && !autoFecha;
    } else if (tag === "w:tab" && autoFecha) {
      paragrafo += " ";
    } else if (tag === "w:br" && autoFecha) {
      paragrafo += " ";
    } else if (tag === "w:p" && fecha) {
      fecharParagrafo();
    } else if (tag === "w:tr") {
      if (fecha) {
        const linha = (celulas ?? []).filter(Boolean).join(" | ");
        if (linha) linhas.push(linha);
        celulas = null;
      } else {
        celulas = [];
      }
    } else if (tag === "w:tc" && fecha && celulas) {
      fecharParagrafo();
      celulas.push(celula.trim());
      celula = "";
    }
  }
  fecharParagrafo();
  return linhas;
}

/** Cabeçalhos do documento, na ordem: por seção, primeira página antes das demais. */
export async function lerCabecalhosDocx(dados: ArrayBuffer | Uint8Array): Promise<CabecalhoDocx[]> {
  const zip = await JSZip.loadAsync(dados);
  const documento = await zip.file("word/document.xml")?.async("string");
  const rels = await zip.file("word/_rels/document.xml.rels")?.async("string");
  if (!documento || !rels) return [];

  const alvoPorId = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = m[0].match(/\bId="([^"]+)"/)?.[1];
    const alvo = m[0].match(/\bTarget="([^"]+)"/)?.[1];
    if (id && alvo && /header\d*\.xml$/.test(alvo)) alvoPorId.set(id, alvo.replace(/^\/?word\//, ""));
  }

  const secoes = [...documento.matchAll(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/g)].map((m) => m[0]);
  const varias = secoes.length > 1;
  const saida: CabecalhoDocx[] = [];
  const vistos = new Map<string, CabecalhoDocx>();

  for (const [i, secao] of secoes.entries()) {
    const primeiraDiferente = /<w:titlePg(?:\s[^>]*)?\/>/.test(secao) && !/<w:titlePg\s+w:val="(?:0|false)"/.test(secao);
    const refs = [...secao.matchAll(/<w:headerReference\b[^>]*>/g)].map((m) => ({
      tipo: m[0].match(/w:type="(\w+)"/)?.[1] ?? "default",
      id: m[0].match(/r:id="([^"]+)"/)?.[1] ?? "",
    }));
    // Primeira página antes das demais, que é a ordem em que o papel é lido.
    refs.sort((a, b) => (a.tipo === "first" ? -1 : b.tipo === "first" ? 1 : 0));

    for (const ref of refs) {
      if (ref.tipo === "first" && !primeiraDiferente) continue; // declarado, mas não usado
      const alvo = alvoPorId.get(ref.id);
      const xml = alvo ? await zip.file(`word/${alvo}`)?.async("string") : undefined;
      if (!xml) continue;
      const linhas = textoDoXmlWord(xml);
      if (linhas.length === 0) continue;

      const rotulo = `${varias ? `seção ${i + 1}, ` : ""}${ROTULO_TIPO[ref.tipo] ?? ref.tipo}`;
      const chave = linhas.join("\n");
      const igual = vistos.get(chave);
      if (igual) {
        // Mesmo texto em dois lugares: um cabeçalho só, com os dois rótulos.
        igual.rotulo = `${igual.rotulo} e ${rotulo}`;
        continue;
      }
      const cabecalho = { rotulo, linhas };
      vistos.set(chave, cabecalho);
      saida.push(cabecalho);
    }
  }
  return saida;
}

/** Os cabeçalhos em Markdown, no bloco que o prompt da passagem espera. */
export function cabecalhosEmMarkdown(cabecalhos: CabecalhoDocx[]): string {
  if (cabecalhos.length === 0) return "";
  const blocos = cabecalhos.map((c) => `## Cabeçalho — ${c.rotulo}\n${c.linhas.join("\n")}`);
  return `# CABEÇALHOS DO DOCUMENTO\n\n${blocos.join("\n\n")}`;
}
