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
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  remember(token, data.user.id);
  return data.user.id;
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!token) {
    if (authRequired()) {
      res.status(401).json({ error: "unauthorized", message: "Token de acesso ausente." });
      return;
    }
    req.userId = null;
    next();
    return;
  }

  const userId = await resolveUserId(token);
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
