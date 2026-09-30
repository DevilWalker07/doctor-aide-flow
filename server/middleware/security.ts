import cors from "cors";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request, RequestHandler } from "express";
import { allowedOrigins, isProduction } from "../config.js";

const EXPOSED_HEADERS = [
  "Content-Disposition",
  "X-Pacientes-Count",
  "X-Alertas-Count",
  "X-File-Warnings",
  "X-Batches-Failed",
  "Deprecation",
];

const LOCALHOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export function buildCors(): RequestHandler {
  const allowlist = allowedOrigins();
  return cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowlist.includes(origin)) return cb(null, true);
      if (!isProduction && allowlist.length === 0 && LOCALHOST_RE.test(origin))
        return cb(null, true);
      cb(null, false);
    },
    credentials: false,
    exposedHeaders: EXPOSED_HEADERS,
    maxAge: 600,
  });
}

const keyByUser = (req: Request) => req.userId ?? ipKeyGenerator(req.ip ?? "");

function limiter(max: number) {
  return rateLimit({
    windowMs: 60_000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: keyByUser,
    message: {
      error: "rate_limited",
      message: "Muitas requisições. Tente novamente em instantes.",
    },
  });
}

export function buildRateLimiters() {
  return {
    ai: limiter(60),
    upload: limiter(20),
    poll: limiter(240),
  };
}
