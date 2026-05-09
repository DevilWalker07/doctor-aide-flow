export type AntibioticDayResult = {
  day: string;
  needsConfirmation: boolean;
  explanation: string;
};

export function calculateAntibioticDay(params: {
  startDate?: string;
  referenceDate: string;
  frequency?: string;
  startTime?: string;
}): AntibioticDayResult {
  if (!params.startDate) {
    return { day: "[CONFIRMAR DI]", needsConfirmation: true, explanation: "Data de inicio nao informada." };
  }

  const start = new Date(`${params.startDate}T00:00:00`);
  const ref = new Date(`${params.referenceDate}T00:00:00`);
  const diffDays = Math.floor((ref.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  if (!Number.isFinite(diffDays) || diffDays < 0) {
    return { day: "[CONFIRMAR DATA]", needsConfirmation: true, explanation: "Data invalida para contagem." };
  }

  const frequency = params.frequency?.toLowerCase() ?? "";
  const onceDaily = frequency.includes("24/24") || frequency.includes("1x") || frequency.includes("uma vez");

  if (onceDaily) {
    return { day: `D${diffDays + 1}`, needsConfirmation: false, explanation: "Esquema diario: conta D1 no dia da primeira administracao." };
  }

  if (!params.startTime) {
    return { day: `D${diffDays + 1}`, needsConfirmation: true, explanation: "Horario inicial nao informado; confirmar D0/D1." };
  }

  const hour = Number(params.startTime.split(":")[0]);
  if ((frequency.includes("6/6") || frequency.includes("8/8")) && hour >= 10 && diffDays === 0) {
    return { day: "D0", needsConfirmation: true, explanation: "Esquema de multiplas doses iniciado tardiamente pode nao completar o ciclo do primeiro dia." };
  }

  return { day: `D${diffDays + 1}`, needsConfirmation: false, explanation: "Contagem por data de inicio e referencia." };
}
