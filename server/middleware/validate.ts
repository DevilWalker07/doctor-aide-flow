import type { RequestHandler } from "express";
import type { z } from "zod";

export function validateBody<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      next(parsed.error);
      return;
    }
    req.body = parsed.data;
    next();
  };
}
