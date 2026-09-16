import { Router, type RequestHandler } from "express";
import type { z } from "zod";
import {
  CopilotoBody,
  EncaminhamentoBody,
  EvolucaoBody,
  EvolutionReviewBody,
  MotorLuanTextBody,
  RoundBody,
  SugerirReceitaBody,
} from "../schemas/ai.schemas.js";
import { motorLuanService } from "../services/motorLuan.service.js";

export const aiRouter = Router();

interface Ctx {
  userId: string | null;
}

function route<B>(
  schema: z.ZodType<B, z.ZodTypeDef, unknown>,
  handler: (body: B, ctx: Ctx) => Promise<unknown>,
  opts: { deprecated?: boolean } = {},
): RequestHandler {
  return async (req, res, next) => {
    try {
      const body = schema.parse(req.body ?? {});
      const result = await handler(body, { userId: req.userId });
      if (opts.deprecated) res.setHeader("Deprecation", "true");
      res.json(result);
    } catch (err) {
      next(err);
    }
  };
}

aiRouter.post("/orquestrador", route(MotorLuanTextBody, (b) => motorLuanService.orquestrador(b)));
aiRouter.post("/extrair-clinica-medica", route(MotorLuanTextBody, (b) => motorLuanService.extrairClinicaMedica(b)));
aiRouter.post("/extrair-pediatria", route(MotorLuanTextBody, (b) => motorLuanService.extrairPediatria(b)));
aiRouter.post("/extrair-uti", route(MotorLuanTextBody, (b) => motorLuanService.extrairUti(b)));
aiRouter.post("/gerar-evolucao", route(EvolucaoBody, (b) => motorLuanService.gerarEvolucao(b)));
aiRouter.post("/revisar-evolucao", route(EvolutionReviewBody, (b) => motorLuanService.reviewEvolution(b)));
aiRouter.post("/importar-evolucoes-ontem", route(MotorLuanTextBody, (b) => motorLuanService.importarEvolucoesOntem(b)));
aiRouter.post("/gerar-mapa-plantao", route(RoundBody, (b) => motorLuanService.gerarMapaPlantao(b)));
aiRouter.post("/gerar-briefing", route(RoundBody, (b) => motorLuanService.gerarBriefing(b)));
aiRouter.post("/gerar-encaminhamento", route(EncaminhamentoBody, (b) => motorLuanService.gerarEncaminhamento(b)));
aiRouter.post("/sugerir-receita", route(SugerirReceitaBody, (b) => motorLuanService.sugerirReceita(b)));
aiRouter.post("/copiloto", route(CopilotoBody, (b) => motorLuanService.copiloto(b)));

const legacy = { deprecated: true };
aiRouter.post("/lab-extractor", route(MotorLuanTextBody, (b) => motorLuanService.extrairClinicaMedica({ ...b, task: "lab-extractor" }), legacy));
aiRouter.post("/evolution-generator", route(EvolucaoBody, (b) => motorLuanService.gerarEvolucao(b), legacy));
aiRouter.post("/evolution-reviewer", route(EvolutionReviewBody, (b) => motorLuanService.reviewEvolution(b), legacy));
aiRouter.post("/import-yesterday-evolutions", route(MotorLuanTextBody, (b) => motorLuanService.importarEvolucoesOntem(b), legacy));
aiRouter.post("/round-map-generator", route(RoundBody, (b) => motorLuanService.gerarMapaPlantao(b), legacy));
aiRouter.post("/briefing-generator", route(RoundBody, (b) => motorLuanService.gerarBriefing(b), legacy));
