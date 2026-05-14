import type { Sex } from "../types/patient";

export function calcularCKDEPI2021(creatinina: number, idade: number, sexo: Sex): number {
  if (!creatinina || !idade) return 0;
  const feminino = sexo.toUpperCase().includes("F");
  const k = feminino ? 0.7 : 0.9;
  const fatorSexo = feminino ? 1.012 : 1.0;
  const ratio = creatinina / k;
  const tfge =
    142 *
    Math.pow(Math.min(ratio, 1), -0.241) *
    Math.pow(Math.max(ratio, 1), -1.2) *
    Math.pow(0.9938, idade) *
    fatorSexo;
  return Math.round(tfge);
}

export function classificarDRC(tfge: number): { stage: string; label: string; warn: boolean } {
  if (tfge <= 0) return { stage: "-", label: "NÃO CALCULADO", warn: false };
  if (tfge >= 90) return { stage: "G1", label: "NORMAL OU AUMENTADA", warn: false };
  if (tfge >= 60) return { stage: "G2", label: "LEVEMENTE DIMINUÍDA", warn: false };
  if (tfge >= 45) return { stage: "G3A", label: "LEVE A MODERADAMENTE DIMINUÍDA", warn: true };
  if (tfge >= 30) return { stage: "G3B", label: "MODERADA A GRAVEMENTE DIMINUÍDA", warn: true };
  if (tfge >= 15) return { stage: "G4", label: "GRAVEMENTE DIMINUÍDA", warn: true };
  return { stage: "G5", label: "FALÊNCIA RENAL", warn: true };
}
