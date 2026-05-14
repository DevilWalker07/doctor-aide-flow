export function calcularHgtStats(values: (number | undefined | null)[]) {
  const arr = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0);
  if (!arr.length) return { mean: 0, peak: 0, nadir: 0, count: 0, hiperglicemia: false, hipoglicemia: false };
  const mean = Math.round(arr.reduce((sum, value) => sum + value, 0) / arr.length);
  const peak = Math.max(...arr);
  const nadir = Math.min(...arr);
  return { mean, peak, nadir, count: arr.length, hiperglicemia: peak > 180, hipoglicemia: nadir < 70 };
}
