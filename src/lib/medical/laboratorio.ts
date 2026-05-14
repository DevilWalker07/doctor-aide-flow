export function detectarReascensaoPCR(values: number[]) {
  if (values.length < 3) return false;
  const previousMin = Math.min(...values.slice(0, -1));
  const last = values[values.length - 1];
  return last > previousMin * 1.5;
}

export function formatarLaboratorio(vals: Record<string, string | number | null | undefined>, date = new Date().toLocaleDateString("pt-BR")) {
  const get = (...keys: string[]) => {
    for (const key of keys) {
      const value = vals[key] ?? vals[key.toUpperCase()];
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return "NÃO REFERIDO";
  };

  return `LAB ATUAL (${date}): HB ${get("hb", "Hemoglobina")} / HT ${get("ht", "Hematócrito")} / LEUCO ${get("leukocytes", "leucocitos", "Leuco")} (${get("segmentedPercent", "segmentados_percent", "Segmentados")}% SEG / ${get("bandsPercent", "bastoes_percent", "Bastões")}% BAST) / PLQ ${get("platelets", "plaquetas", "Plq")} / CR ${get("creatinine", "creatinina", "Cr")} / UR ${get("urea", "Ureia")} / NA ${get("sodium", "sodio", "Na")} / K ${get("potassium", "potassio", "K")} / PCR ${get("crp", "pcr", "PCR")}`;
}

export function gerarAnaliseLaboratorialLocal(vals: Record<string, string>) {
  const alerts: string[] = [];
  const parse = (value?: string) => Number(String(value || "").replace(",", "."));
  const hb = parse(vals.Hb || vals.Hemoglobina || vals.hb);
  const cr = parse(vals.Creatinina || vals.Cr || vals.creatinina);
  const pcr = parse(vals.PCR || vals.pcr);
  if (hb > 0 && hb < 10) alerts.push(hb < 7 ? "ANEMIA GRAVE" : "ANEMIA");
  if (cr > 1.5) alerts.push("DISFUNÇÃO RENAL");
  if (pcr > 10) alerts.push("PROVA INFLAMATÓRIA ELEVADA");
  return alerts.length ? alerts.join(". ") + "." : "SEM ALERTAS LABORATORIAIS AUTOMÁTICOS.";
}
