/**
 * Botão "voltar" do celular (Android, gesto de voltar) fecha o que está por
 * cima — gaveta, modo RCP — em vez de sair da página no meio de uma parada.
 *
 * Cada camada aberta empilha uma entrada no histórico. Um único ouvinte de
 * `popstate` entrega o "voltar" só à camada do topo. Camada fechada pelo X
 * desempilha a própria entrada com `history.back()`, e esse "voltar" sintético
 * é ignorado para não fechar a camada de baixo.
 *
 * `manter`: a camada não fecha com o voltar (o modo RCP); recebe o aviso e a
 * entrada volta para a pilha.
 */
import { useEffect, useRef } from "react";

interface Camada {
  marca: string;
  aoVoltar: () => void;
  manter: boolean;
}

const pilha: Camada[] = [];
let ignorar = 0;
let ouvindo = false;

const empurrarHistorico = (marca: string) => {
  const atual = (window.history.state ?? {}) as Record<string, unknown>;
  window.history.pushState({ ...atual, pedCamada: marca }, "");
};

function aoPopState() {
  if (ignorar > 0) {
    ignorar -= 1;
    return;
  }
  const topo = pilha.at(-1);
  if (!topo) return;
  if (topo.manter) {
    empurrarHistorico(topo.marca);
  } else {
    pilha.pop();
  }
  topo.aoVoltar();
}

function garantirOuvinte() {
  if (ouvindo || typeof window === "undefined") return;
  window.addEventListener("popstate", aoPopState);
  ouvindo = true;
}

export function useVoltarFecha(aberto: boolean, aoVoltar: () => void, manter = false) {
  const cb = useRef(aoVoltar);
  cb.current = aoVoltar;

  useEffect(() => {
    if (!aberto) return;
    garantirOuvinte();
    const marca = Math.random().toString(36).slice(2);
    const camada: Camada = { marca, aoVoltar: () => cb.current(), manter };
    pilha.push(camada);
    empurrarHistorico(marca);
    return () => {
      const i = pilha.indexOf(camada);
      if (i === -1) return; // já saiu da pilha pelo voltar
      pilha.splice(i, 1);
      // fechou pelo X: tira a própria entrada do histórico sem fechar a de baixo
      if ((window.history.state as { pedCamada?: string } | null)?.pedCamada === marca) {
        ignorar += 1;
        window.history.back();
      }
    };
  }, [aberto, manter]);
}

/** Só para testes. */
export const _pilhaVoltar = pilha;
