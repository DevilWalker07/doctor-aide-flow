import type { AtestadoDocumento, FinalidadeAtestado } from "./types";

export const FINALIDADES: Array<{
  id: FinalidadeAtestado;
  label: string;
  descricao: string;
}> = [
  {
    id: "afastamento",
    label: "Afastamento",
    descricao: "Repouso por um número de dias",
  },
  {
    id: "comparecimento",
    label: "Comparecimento",
    descricao: "Esteve na consulta em determinado horário",
  },
  {
    id: "acompanhante",
    label: "Acompanhante",
    descricao: "Acompanhou outra pessoa no atendimento",
  },
  {
    id: "atividade-fisica",
    label: "Aptidão física",
    descricao: "Apto a praticar atividade física",
  },
];

/**
 * O CID entra no atestado apenas com autorização expressa do paciente.
 * Esta é a única porta por onde o CID chega ao documento — a interface, o texto
 * para WhatsApp e a folha A4 todos passam por aqui, para não haver um caminho
 * que exponha diagnóstico sem consentimento.
 */
export function cidVisivel(doc: AtestadoDocumento): string | null {
  if (!doc.cidAutorizado) return null;
  const cid = doc.cid.trim();
  return cid ? cid : null;
}

function plural(n: number, um: string, muitos: string) {
  return n === 1 ? um : muitos;
}

/**
 * Corpo do atestado em prosa, como vai para a folha e para o texto copiado.
 * Sem paciente ou sem os dados da finalidade, devolve string vazia — quem
 * consome mostra o aviso de "preencha para gerar".
 */
export function corpoAtestado(doc: AtestadoDocumento): string {
  const nome = doc.paciente.nome.trim();
  if (!nome) return "";

  const partes: string[] = [];
  const atendido = `Atesto que ${nome}`;

  switch (doc.finalidade) {
    case "afastamento": {
      const dias = Number.parseInt(doc.dias, 10);
      if (!Number.isFinite(dias) || dias < 1) return "";
      partes.push(
        `${atendido} esteve sob meus cuidados profissionais e necessita de afastamento de suas atividades por ${dias} ${plural(dias, "dia", "dias")}` +
          (doc.dataInicio.trim() ? `, a contar de ${doc.dataInicio.trim()}` : "") +
          ".",
      );
      break;
    }
    case "comparecimento": {
      const quando = doc.dataInicio.trim();
      if (!quando) return "";
      const horario =
        doc.horaInicio.trim() && doc.horaFim.trim()
          ? `, das ${doc.horaInicio.trim()} às ${doc.horaFim.trim()}`
          : doc.horaInicio.trim()
            ? `, às ${doc.horaInicio.trim()}`
            : "";
      partes.push(`${atendido} compareceu a consulta médica em ${quando}${horario}.`);
      break;
    }
    case "acompanhante": {
      const acompanhado = doc.acompanhado.trim();
      const quando = doc.dataInicio.trim();
      if (!acompanhado || !quando) return "";
      partes.push(
        `${atendido} compareceu a esta unidade em ${quando} como acompanhante de ${acompanhado}.`,
      );
      break;
    }
    case "atividade-fisica": {
      partes.push(
        `${atendido} foi avaliado(a) por mim e, no momento, encontra-se apto(a) para a prática de atividade física.`,
      );
      break;
    }
  }

  const cid = cidVisivel(doc);
  if (cid) partes.push(`CID: ${cid} (informado com autorização do paciente).`);

  const obs = doc.observacoes.trim();
  if (obs) partes.push(obs);

  return partes.join("\n\n");
}

/** Título curto do documento, usado no histórico. */
export function tituloAtestado(doc: AtestadoDocumento): string {
  const finalidade = FINALIDADES.find((f) => f.id === doc.finalidade)?.label ?? "Atestado";
  const nome = doc.paciente.nome.trim();
  return nome ? `Atestado — ${finalidade} — ${nome}` : `Atestado — ${finalidade}`;
}
