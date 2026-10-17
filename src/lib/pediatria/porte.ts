/** Porte da criança para a ilustração: pela idade quando há, senão pelo peso. */
export type Porte = "bebe" | "pequeno" | "escolar" | "adolescente";

export function porteDe(peso: number | null, idadeAnos: number | null): Porte {
  if (idadeAnos !== null) {
    if (idadeAnos < 1) return "bebe";
    if (idadeAnos < 6) return "pequeno";
    if (idadeAnos < 12) return "escolar";
    return "adolescente";
  }
  const p = peso ?? 10;
  if (p < 10) return "bebe";
  if (p < 20) return "pequeno";
  if (p < 40) return "escolar";
  return "adolescente";
}
