import { z } from "zod";

export const motorLuanTextSchema = z.object({
  inputText: z.string().optional(),
  rawText: z.string().optional(),
  text: z.string().optional(),
  patientContext: z.unknown().optional(),
  context: z.unknown().optional(),
  task: z.string().optional(),
});

export const roundSchema = z.object({
  patients: z.array(z.unknown()).default([]),
  sector: z.string().default("CLÍNICA MÉDICA FEMININA"),
  date: z.string().default(new Date().toLocaleDateString("pt-BR")),
});
