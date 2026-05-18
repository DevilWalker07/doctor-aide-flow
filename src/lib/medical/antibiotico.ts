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

/**
 * Considera um ATB ativo se:
 * - status === "ativo" OU não informado (backward-compat)
 * - E sem data_fim, OU data_fim no futuro
 *
 * ATB com status "finalizado"/"suspenso", ou com data_fim já passada,
 * deve ser ignorado em cálculos de D-day, gravidade e alertas.
 */
export function isAtbAtivo(a: {
  status?: string;
  data_fim?: string;
  dataFim?: string;
  end_date?: string;
}): boolean {
  const status = (a.status || "").toLowerCase();
  if (status === "finalizado" || status === "suspenso") return false;
  const fim = a.data_fim || a.dataFim || a.end_date;
  if (fim) {
    const d = new Date(`${fim}T00:00:00`);
    if (!isNaN(d.getTime()) && d.getTime() <= Date.now()) return false;
  }
  return true;
}
