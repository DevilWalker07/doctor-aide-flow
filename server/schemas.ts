import { z } from "zod";

export const textBody = z.object({
  inputText: z.string().optional(),
  rawText: z.string().optional(),
  evolutionText: z.string().optional(),
  patientContext: z.unknown().optional(),
  context: z.unknown().optional(),
});

export const roundBody = z.object({
  patients: z.array(z.unknown()).default([]),
  sector: z.string().default("CLÍNICA MÉDICA FEMININA"),
  date: z.string().default(new Date().toLocaleDateString("pt-BR")),
});
