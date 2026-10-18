import { storage } from "@/lib/storage";

/**
 * Quem entra na emergência pediátrica.
 *
 * A aba exige conta (convidada pelo dono). Mas é ferramenta de sala vermelha:
 * login não pode virar obstáculo no meio de uma parada. Por isso o login
 * **libera o aparelho** por 30 dias, e a liberação vale sem rede e com o
 * Supabase fora do ar. Sem isso, um token vencido (1 h) com o celular sem
 * sinal faria o supabase-js devolver sessão nula e a aba trancaria.
 *
 * É uma porta, não um cofre: quem mexe no localStorage do próprio navegador
 * entra. Cobrança, quando houver, precisa ser conferida no servidor.
 */
export const VALIDADE_ACESSO_MS = 30 * 24 * 60 * 60 * 1000;

interface Liberacao {
  userId: string;
  ate: number;
}

export function liberarAparelho(userId: string, agora = Date.now()): void {
  try {
    storage.setPedAcesso(JSON.stringify({ userId, ate: agora + VALIDADE_ACESSO_MS }));
  } catch {
    /* storage bloqueado: vale só a sessão */
  }
}

export function revogarAparelho(): void {
  try {
    storage.clearPedAcesso();
  } catch {
    /* nada a apagar */
  }
}

export function aparelhoLiberado(agora = Date.now()): boolean {
  try {
    const bruto = storage.getPedAcesso();
    if (!bruto) return false;
    const l = JSON.parse(bruto) as Partial<Liberacao>;
    return typeof l.userId === "string" && typeof l.ate === "number" && l.ate > agora;
  } catch {
    return false;
  }
}

/** Sem Supabase configurado (modo local, e2e) a aba é livre, como o resto do app. */
export function podeEntrarNaPediatria(
  auth: { configured: boolean; session: unknown },
  agora = Date.now(),
): boolean {
  return !auth.configured || Boolean(auth.session) || aparelhoLiberado(agora);
}
