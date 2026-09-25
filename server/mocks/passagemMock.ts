/**
 * Respostas de IA da passagem em modo `AI_MOCK=1`.
 *
 * Diferente das outras fixtures, estas dependem da entrada: o e2e sobe vários
 * arquivos e cada um precisa virar o SEU leito, senão todos colidiriam no
 * mesmo. O mock lê o cabeçalho do Markdown do jeito que o prompt manda a IA
 * ler — o de data mais recente vence, conflitos são relatados — para o teste
 * exercitar o caminho inteiro com dados fictícios. Não é um leitor clínico.
 */

interface Bloco {
  rotulo: string;
  campos: Map<string, string>;
}

function lerCabecalhos(md: string): Bloco[] {
  const blocos: Bloco[] = [];
  let atual: Bloco | null = null;
  for (const linha of md.split("\n")) {
    const titulo = linha.match(/^##?\s*CABEÇALHO(?:\s*—\s*(.+))?\s*$/i);
    if (titulo) {
      atual = { rotulo: titulo[1] ?? "topo", campos: new Map() };
      blocos.push(atual);
      continue;
    }
    if (/^#\s/.test(linha) && !/CABEÇALHOS DO DOCUMENTO/i.test(linha)) atual = null;
    if (!linha.trim()) atual = null;
    if (!atual) continue;
    // A unidade do modelo é uma linha solta acima da tabela de identificação.
    if (!linha.includes("|") && linha.trim() && !atual.campos.has("UNIDADE")) {
      atual.campos.set("UNIDADE", linha.trim());
      continue;
    }
    // Como nos arquivos reais: "LEITO: 01" numa célula, ou "PRONTUÁRIO:" e o
    // valor na célula seguinte.
    const celulas = linha.split("|").map((c) => c.trim());
    for (let i = 0; i < celulas.length; i++) {
      const m = celulas[i].match(/^([^:]+):\s*(.*)$/);
      if (!m) continue;
      const rotulo = m[1].trim().toUpperCase();
      const valor =
        m[2].trim() || (celulas[i + 1] && !celulas[i + 1].includes(":") ? celulas[++i] : "");
      if (valor) atual.campos.set(rotulo, valor);
    }
  }
  return blocos;
}

function dataValor(br: string | undefined): number {
  const m = br?.match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
  if (!m) return 0;
  const ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return Date.UTC(ano, Number(m[2]) - 1, Number(m[1]));
}

function textoDe(payload: unknown): string {
  if (payload && typeof payload === "object" && "documento" in payload) {
    return String((payload as { documento: unknown }).documento ?? "");
  }
  return "";
}

export function mockPassagemLeito(payload: unknown) {
  const md = textoDe(payload);
  const blocos = lerCabecalhos(md);
  const escolhido = [...blocos].sort(
    (a, b) => dataValor(b.campos.get("DATA")) - dataValor(a.campos.get("DATA")),
  )[0];
  const conflitos: string[] = [];
  if (escolhido) {
    for (const outro of blocos) {
      if (outro === escolhido) continue;
      for (const [campo, valor] of outro.campos) {
        const usado = escolhido.campos.get(campo);
        if (usado && usado !== valor && campo !== "DATA") {
          conflitos.push(
            `${campo}: ${usado} (${escolhido.rotulo}) × ${valor} (${outro.rotulo}) — usado ${usado}`,
          );
        }
      }
    }
  }
  const labs = [...md.matchAll(/^#\s*LABORAT[ÓO]RIO[^\n]*\n+([^\n]+)/gim)].map((m) => m[1]);
  const ultimoLab = labs.length
    ? labs[labs.length - 1].replace(/\s*\|\s*/g, ", ")
    : "Sem lab recente";
  const campos = escolhido?.campos;
  const nome = campos?.get("NOME") ?? null;

  return {
    _raciocinio: "MOCK",
    identificacao: {
      nome,
      idade: campos?.get("IDADE") ?? null,
      leito: campos?.get("LEITO") ?? null,
      dih: campos?.get("DATA DA ADMISSÃO") ?? null,
      unidade: campos?.get("UNIDADE DE INTERNAÇÃO") ?? campos?.get("UNIDADE") ?? null,
      prontuario: campos?.get("Nº DE PRONTUÁRIO") ?? null,
      fonte: escolhido ? `cabeçalho — ${escolhido.rotulo}` : "",
      conflitos,
    },
    diagnostico: campos?.get("DIAGNÓSTICOS DE INTERNAÇÃO") ?? "NÃO REFERIDO",
    quadroAtual: "ESTÁVEL — MOCK (AI_MOCK=1).",
    atb: /CEFTRIAXONA/i.test(md) ? "Ceftriaxona 1g EV 12/12h — D3" : "SEM ATB",
    ultimoLab,
    condutasHoje: "- MANTER CONDUTA (MOCK)",
    alertasPendencias: "! REVISAR (MOCK)\n— PENDÊNCIAS —\n- CONFERIR LAB DE AMANHÃ",
    dispositivos: null,
    anotacoesVisita: "",
    resumoLinha: nome ? `${nome.split(" ")[0]} – CASO MOCK` : "",
    sugestoesClinicas: ["Sugestão fictícia do modo mock."],
    alertasCriticos: [{ prioridade: "! HOJE", acao: "REVISAR (MOCK)" }],
  };
}

export function mockTranscricao() {
  return {
    markdown: [
      "# CABEÇALHO",
      "NOME: | PACIENTE FOTO FICTÍCIO | DATA: | 25/09/2026",
      "DATA DA ADMISSÃO: | 24/09/2026 | LEITO: | 08",
      "",
      "EVOLUÇÃO MEDICA",
      "# LABORATÓRIO (25/09)",
      "HB 12,0 | K [ilegível] | CR 0,9",
    ].join("\n"),
    trechos_ilegiveis: ["K [ilegível] no laboratório de 25/09"],
  };
}

export function mockConsolidacao(payload: unknown) {
  const leitos =
    payload && typeof payload === "object" && "leitos" in payload
      ? ((payload as { leitos: { leito: string; paciente: string }[] }).leitos ?? [])
      : [];
  return {
    _raciocinio: "MOCK",
    prioridades: leitos.slice(0, 3).map((l) => ({
      prioridade: "! HOJE",
      leito: l.leito,
      paciente: l.paciente.split(/[ ,]/)[0],
      texto: "REVISAR CONDUTA — MOCK",
    })),
    pendencias: {
      admissoesPendentes: [],
      labsAIncorporar: leitos.slice(0, 1).map((l) => `${l.leito}: LAB DE AMANHÃ (MOCK)`),
      procedimentosAgendados: [],
      altasEmProgramacao: [],
      avisosCriticos: [],
    },
  };
}
