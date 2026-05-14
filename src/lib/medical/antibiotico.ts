export function calcularDiaAtb(dataInicio: string, hoje: string, modo: "D0" | "D1" = "D1"): number {
  if (!dataInicio) return 0;
  const inicio = new Date(`${dataInicio}T00:00:00`);
  const atual = new Date(`${hoje}T00:00:00`);
  const diff = Math.floor((atual.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
  return modo === "D1" ? diff + 1 : diff;
}

export function cicloAtbExcedido(dataInicio: string, hoje: string, duracaoDias: number, modo: "D0" | "D1" = "D1") {
  return calcularDiaAtb(dataInicio, hoje, modo) > duracaoDias;
}
