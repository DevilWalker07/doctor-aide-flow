import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";

export type EstadoBackend = "verificando" | "online" | "offline";

export interface SaudeBackend {
  estado: EstadoBackend;
  /** Motivos vindos do servidor quando ele sobe sem configuração completa. */
  motivos: string[];
  recarregar: () => void;
}

interface Leitura {
  estado: Exclude<EstadoBackend, "verificando">;
  motivos: string[];
  em: number;
}

const TTL_MS = 30_000;
let cache: Leitura | null = null;
let emVoo: Promise<Leitura> | null = null;
const ouvintes = new Set<(l: Leitura) => void>();

async function consultar(): Promise<Leitura> {
  let leitura: Leitura;
  try {
    const res = await apiFetch("/health");
    const corpo = (await res.json().catch(() => null)) as {
      ok?: boolean;
      configErrors?: string[];
    } | null;
    leitura = {
      estado: res.ok && corpo?.ok !== false ? "online" : "offline",
      motivos: corpo?.configErrors ?? [],
      em: Date.now(),
    };
  } catch {
    // apiFetch já converte falha de rede em ApiError; aqui só importa que
    // não houve resposta.
    leitura = { estado: "offline", motivos: [], em: Date.now() };
  }
  cache = leitura;
  for (const ouvinte of ouvintes) ouvinte(leitura);
  return leitura;
}

function buscar(forcar = false): Promise<Leitura> {
  if (!forcar && cache && Date.now() - cache.em < TTL_MS) return Promise.resolve(cache);
  if (!emVoo) emVoo = consultar().finally(() => (emVoo = null));
  return emVoo;
}

/**
 * Estado do servidor de IA, compartilhado por todas as telas.
 *
 * Antes cada botão de IA falhava sozinho, com erro genérico — o médico
 * descobria que o servidor tinha caído depois de tentar quatro coisas
 * diferentes. Uma leitura só, em cache curto, alimenta a faixa do hub e o
 * indicador das Configurações.
 */
export function useBackendHealth(): SaudeBackend {
  const [leitura, setLeitura] = useState<Leitura | null>(cache);

  useEffect(() => {
    let vivo = true;
    const ouvinte = (l: Leitura) => {
      if (vivo) setLeitura(l);
    };
    ouvintes.add(ouvinte);
    void buscar().then(ouvinte);
    return () => {
      vivo = false;
      ouvintes.delete(ouvinte);
    };
  }, []);

  const recarregar = useCallback(() => {
    setLeitura(null);
    void buscar(true);
  }, []);

  return {
    estado: leitura?.estado ?? "verificando",
    motivos: leitura?.motivos ?? [],
    recarregar,
  };
}
