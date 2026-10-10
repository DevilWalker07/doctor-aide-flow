import type { RequestHandler } from "express";
import { authRequired } from "../config.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId: string | null;
    }
  }
}

const CACHE_TTL_MS = 60_000;
const PRAZO_SUPABASE_MS = 3_000;

class SupabaseSemResposta extends Error {
  constructor() {
    super(`O serviço de login não respondeu em ${PRAZO_SUPABASE_MS / 1000} s.`);
  }
}
const CACHE_MAX = 500;
const cache = new Map<string, { userId: string; exp: number }>();

function remember(token: string, userId: string) {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(token, { userId, exp: Date.now() + CACHE_TTL_MS });
}

export async function resolveUserId(token: string): Promise<string | null> {
  const hit = cache.get(token);
  if (hit && hit.exp > Date.now()) return hit.userId;
  cache.delete(token);

  const admin = getSupabaseAdmin();
  if (!admin) return null;
  // Com prazo: sem ele, Supabase que não responde pendura a requisição até a
  // plataforma cortar aos 60 s — e o médico vê só um spinner.
  const resposta = await Promise.race([
    admin.auth.getUser(token),
    new Promise<never>((_, rejeitar) =>
      setTimeout(() => rejeitar(new SupabaseSemResposta()), PRAZO_SUPABASE_MS).unref?.(),
    ),
  ]);
  const { data, error } = resposta;
  if (error || !data.user) return null;
  remember(token, data.user.id);
  return data.user.id;
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  // Login OPCIONAL: o token nem é conferido. Conferir era uma chamada ao
  // Supabase em toda requisição — e em produção o Supabase parou de responder
  // à função: toda ferramenta de IA de quem tinha sessão salva pendurava 60 s,
  // inclusive a passagem de plantão, que não usa banco nenhum. Em modo
  // opcional o anônimo já entra, então ignorar o token não concede nada.
  if (!authRequired()) {
    req.userId = null;
    next();
    return;
  }

  if (!token) {
    res.status(401).json({ error: "unauthorized", message: "Token de acesso ausente." });
    return;
  }

  let userId: string | null;
  try {
    userId = await resolveUserId(token);
  } catch (err) {
    if (!(err instanceof SupabaseSemResposta)) throw err;
    res.status(503).json({ error: "login_indisponivel", message: err.message });
    return;
  }
  if (!userId) {
    res.status(401).json({ error: "unauthorized", message: "Token inválido ou expirado." });
    return;
  }
  req.userId = userId;
  next();
};

export function clearAuthCache() {
  cache.clear();
}
