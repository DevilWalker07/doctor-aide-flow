import { AlertTriangle, Scale } from "lucide-react";
import { useState } from "react";
import {
  PESO_CONFIRMAR,
  PESO_MAX,
  PESO_MIN,
  descreverIdade,
  idadeEmAnos,
  idadeInformada,
  pesoDestoaDaIdade,
  pesoEstimado,
  pesoValido,
  type Idade,
} from "../../../shared/pediatria/calculos";
import { porteDe } from "@/lib/pediatria/porte";
import { Crianca } from "./Ilustracoes";

export interface Paciente {
  peso: number;
  pesoEstimado: boolean;
  idade: Idade | null;
  alturaCm: number | null;
}

const lerNumero = (t: string) => {
  const n = Number(t.replace(",", "."));
  return t.trim() === "" || !Number.isFinite(n) ? null : n;
};
const virgula = (n: number) => String(n).replace(".", ",");

/**
 * Porta de entrada das doses: sem peso, nenhuma dose aparece. O peso estimado
 * pela idade existe, mas entra marcado como "estimado" e por escolha explícita.
 */
export function Identificacao({
  inicial,
  rotuloBotao = "Calcular doses",
  onConfirmar,
}: {
  inicial: Paciente | null;
  rotuloBotao?: string;
  onConfirmar: (p: Paciente) => void;
}) {
  const [pesoTxt, setPesoTxt] = useState(inicial ? virgula(inicial.peso) : "");
  const [anos, setAnos] = useState(inicial?.idade ? String(inicial.idade.anos) : "");
  const [meses, setMeses] = useState(inicial?.idade ? String(inicial.idade.meses) : "");
  const [alturaTxt, setAlturaTxt] = useState(inicial?.alturaCm ? String(inicial.alturaCm) : "");
  const [usouEstimado, setUsouEstimado] = useState(inicial?.pesoEstimado ?? false);
  const [confirmouDestoante, setConfirmouDestoante] = useState(false);

  const peso = lerNumero(pesoTxt);
  const idade: Idade | null =
    anos || meses
      ? {
          anos: Math.max(0, Math.floor(lerNumero(anos) ?? 0)),
          meses: Math.max(0, Math.floor(lerNumero(meses) ?? 0)),
          dias: 0,
        }
      : null;
  const temIdade = idadeInformada(idade);
  const estimado = temIdade ? pesoEstimado(idade) : null;
  const valido = peso !== null && pesoValido(peso);
  const destoa = valido && !usouEstimado && pesoDestoaDaIdade(peso, idade);
  const pesado = valido && peso > PESO_CONFIRMAR;
  const precisaConfirmar = (destoa || pesado) && !confirmouDestoante;
  const porte = porteDe(valido ? peso : null, temIdade ? idadeEmAnos(idade) : null);

  const confirmar = () => {
    if (!valido || precisaConfirmar) return;
    const altura = lerNumero(alturaTxt);
    onConfirmar({
      peso,
      pesoEstimado: usouEstimado,
      idade: temIdade ? idade : null,
      alturaCm: altura && altura > 30 ? altura : null,
    });
  };

  const campo =
    "border-input bg-input-bg text-foreground focus-visible:ring-ring w-full rounded-2xl border px-4 focus-visible:ring-2 focus-visible:outline-none";

  return (
    <form
      className="bg-card border-border mx-auto grid max-w-md gap-5 rounded-[2rem] border p-5"
      onSubmit={(e) => {
        e.preventDefault();
        confirmar();
      }}
    >
      <div className="grid grid-cols-[112px_1fr] items-end gap-4">
        <div className="bg-muted grid h-36 place-items-end justify-center overflow-hidden rounded-3xl">
          <Crianca porte={porte} className="h-32 w-28" />
        </div>
        <div className="grid gap-1">
          <label htmlFor="ped-peso" className="t-label text-muted-foreground">
            Peso
          </label>
          <div className="relative">
            <input
              id="ped-peso"
              data-testid="ped-peso"
              inputMode="decimal"
              autoComplete="off"
              value={pesoTxt}
              onChange={(e) => {
                setPesoTxt(e.target.value);
                setUsouEstimado(false);
                setConfirmouDestoante(false);
              }}
              placeholder="0"
              aria-invalid={peso !== null && !valido}
              className={`${campo} placeholder:text-muted-foreground/35 h-20 pr-14 text-5xl font-black tabular-nums`}
            />
            <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xl font-bold">
              kg
            </span>
          </div>
          {usouEstimado && (
            <span className="t-label text-warning-foreground">Peso estimado pela idade</span>
          )}
        </div>
      </div>

      <fieldset className="grid gap-2">
        <legend className="t-label text-muted-foreground mb-1">
          Idade (recomendado: libera tubo e sinais vitais)
        </legend>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["anos", anos, setAnos, "ped-anos"],
              ["meses", meses, setMeses, "ped-meses"],
            ] as const
          ).map(([rotulo, valor, set, id]) => (
            <label key={rotulo} className="relative">
              <span className="sr-only">{rotulo}</span>
              <input
                data-testid={id}
                inputMode="numeric"
                value={valor}
                onChange={(e) => {
                  set(e.target.value);
                  setConfirmouDestoante(false);
                }}
                placeholder="0"
                className={`${campo} placeholder:text-muted-foreground/35 h-14 pr-20 text-2xl font-extrabold tabular-nums`}
              />
              <span className="t-body text-muted-foreground pointer-events-none absolute top-1/2 right-4 -translate-y-1/2">
                {rotulo}
              </span>
            </label>
          ))}
        </div>
        {estimado !== null && (
          <button
            type="button"
            data-testid="ped-usar-estimado"
            onClick={() => {
              setPesoTxt(virgula(estimado));
              setUsouEstimado(true);
            }}
            className="touch-target border-primary/40 bg-primary/5 text-foreground hover:bg-primary/10 focus-visible:ring-ring t-body flex items-center gap-3 rounded-2xl border border-dashed px-4 py-2 text-left focus-visible:ring-2 focus-visible:outline-none"
          >
            <Scale className="text-primary h-5 w-5 shrink-0" aria-hidden="true" />
            <span>
              Sem balança? Usar <strong className="tabular-nums">{virgula(estimado)} kg</strong>{" "}
              estimados para {descreverIdade(idade!)}
            </span>
          </button>
        )}
      </fieldset>

      <details className="group">
        <summary className="t-label text-muted-foreground cursor-pointer list-none py-1 underline-offset-4 hover:underline">
          Informar altura (opcional)
        </summary>
        <label className="mt-2 grid gap-1">
          <span className="t-label text-muted-foreground">
            Altura em cm — melhora a superfície corporal
          </span>
          <input
            inputMode="numeric"
            value={alturaTxt}
            onChange={(e) => setAlturaTxt(e.target.value)}
            className={`${campo} h-12 text-lg font-bold tabular-nums`}
          />
        </label>
      </details>

      {peso !== null && !valido && (
        <p role="alert" className="t-body text-destructive">
          O peso precisa estar entre {virgula(PESO_MIN)} e {PESO_MAX} kg.
        </p>
      )}

      {(destoa || pesado) && (
        <div
          role="alert"
          className="border-warning/60 bg-warning/10 grid gap-3 rounded-2xl border p-4"
        >
          <p className="t-body text-foreground flex gap-2">
            <AlertTriangle className="text-warning h-5 w-5 shrink-0" aria-hidden="true" />
            {destoa && estimado !== null
              ? `Confira: ${pesoTxt} kg para ${descreverIdade(idade!)}? O esperado é perto de ${virgula(estimado)} kg.`
              : `Confira: ${pesoTxt} kg é peso de adolescente. As doses vão bater no teto adulto.`}
          </p>
          <label className="t-body text-foreground flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              data-testid="ped-confirmar-peso"
              checked={confirmouDestoante}
              onChange={(e) => setConfirmouDestoante(e.target.checked)}
              className="accent-primary h-5 w-5"
            />
            O peso está certo
          </label>
        </div>
      )}

      <button
        type="submit"
        data-testid="ped-calcular"
        disabled={!valido || precisaConfirmar}
        className="bg-foreground text-background focus-visible:ring-ring h-14 rounded-2xl text-lg font-bold transition-opacity focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-30"
      >
        {rotuloBotao}
      </button>
    </form>
  );
}
