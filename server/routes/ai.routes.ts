import { Router } from "express";
import { motorLuanService } from "../services/motorLuan.service.js";

export const aiRouter = Router();

function route(handler: (body: any) => Promise<any>) {
  return async (req: any, res: any) => {
    try {
      res.json(await handler(req.body));
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Falha no Motor Luan." });
    }
  };
}

aiRouter.post("/orquestrador", route((body) => motorLuanService.orquestrador(body)));
aiRouter.post("/extrair-clinica-medica", route((body) => motorLuanService.extrairClinicaMedica(body)));
aiRouter.post("/extrair-pediatria", route((body) => motorLuanService.extrairPediatria(body)));
aiRouter.post("/extrair-uti", route((body) => motorLuanService.extrairUti(body)));
aiRouter.post("/gerar-evolucao", route((body) => motorLuanService.gerarEvolucao(body)));
aiRouter.post("/importar-evolucoes-ontem", route((body) => motorLuanService.importarEvolucoesOntem(body)));
aiRouter.post("/gerar-mapa-plantao", route((body) => motorLuanService.gerarMapaPlantao(body)));
aiRouter.post("/gerar-briefing", route((body) => motorLuanService.gerarBriefing(body)));

// Compatibilidade com os nomes anteriores.
aiRouter.post("/lab-extractor", route((body) => motorLuanService.extrairClinicaMedica({ ...body, task: "lab-extractor" })));
aiRouter.post("/evolution-generator", route((body) => motorLuanService.gerarEvolucao(body)));
aiRouter.post("/evolution-reviewer", route(async () => ({ campos_faltantes: [], inconsistencias: [], alertas: [], sugestoes: [] })));
aiRouter.post("/import-yesterday-evolutions", route((body) => motorLuanService.importarEvolucoesOntem(body)));
aiRouter.post("/round-map-generator", route((body) => motorLuanService.gerarMapaPlantao(body)));
aiRouter.post("/briefing-generator", route((body) => motorLuanService.gerarBriefing(body)));
