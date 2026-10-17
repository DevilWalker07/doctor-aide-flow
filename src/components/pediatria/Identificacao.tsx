import { AlertTriangle, Scale } from "lucide-react";
import { useState } from "react";
import {
  PESO_CONFIRMAR,
  PESO_MAX,
  PESO_MIN,
  descreverIdade,
  idadeInformada,
  pesoDestoaDaIdade,
  pesoEstimado,
  pesoValido,
  type Idade,
} from "../../../shared/pediatria/calculos";
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

/**
 * Porta de entrada: sem peso, nenhuma dose aparece. O peso estimado pela idade
 * existe, mas entra marcado como "estimado" e por escolha explícita.
 */
export function Identificacao({
  inicial,
  onConfirmar,
}: {
  inicial: Paciente | null;
  onConfirmar: (p: Paciente) => void;
}) {
  const [pesoTxt, setPesoTxt] = useState(inicial ? String(inicial.peso).replace(".", ",") : "");
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
  const estimado = idadeInformada(idade) ? pesoEstimado(idade) : null;
  const valido = peso !== null && pesoValido(peso);
  const destoa = valido && !usouEstimado && pesoDestoaDaIdade(peso, idade);
  const pesado = valido && peso > PESO_CONFIRMAR;
  const precisaConfirmar = (destoa || pesado) && !confirmouDestoante;

  const confirmar = () => {
    if (!valido || precisaConfirmar) return;
    const altura = lerNumero(alturaTxt);
    onConfirmar({
      peso,
      pesoEstimado: usouEstimado,
      idade: idadeInformada(idade) ? idade : null,
      alturaCm: altura && altura > 30 ? altura : null,
    });
  };

  const campo =
    "border-input bg-input-bg text-foreground focus-visible:ring-ring w-full rounded-2xl border px-4 focus-visible:ring-2 focus-visible:outline-none";

  return (
    <form
      className="mx-auto grid max-w-md gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        confirmar();
      }}
    >
      <div className="flex items-end gap-4">
        <Crianca peso={valido ? peso : null} className="text-primary h-28 w-24 shrink-0" />
        <div className="min-w-0 flex-1">
          <label htmlFor="ped-peso" className="t-label text-muted-foreground">
            Peso (kg)
          </label>
          <input
            id="ped-peso"
            data-testid="ped-peso"
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            value={pesoTxt}
            onChange={(e) => {
              setPesoTxt(e.target.value);
              setUsouEstimado(false);
              setConfirmouDestoante(false);
            }}
            placeholder="Ex.: 11"
            aria-invalid={peso !== null && !valido}
            className={`${campo} mt-1 h-16 text-3xl font-extrabold tabular-nums`}
          />
        </div>
      </div>

      <fieldset className="grid gap-2">
        <legend className="t-label text-muted-foreground">Idade (recomendado)</legend>
        <div className="grid grid-cols-2 gap-3">
          <label className="relative">
            <span className="sr-only">Anos</span>
            <input
              data-testid="ped-anos"
              inputMode="numeric"
              value={anos}
              onChange={(e) => {
                setAnos(e.target.value);
                setConfirmouDestoante(false);
              }}
              placeholder="0"
              className={`${campo} h-12 pr-14 text-lg font-bold tabular-nums`}
            />
            <span className="t-label text-muted-foreground pointer-events-none absolute top-1/2 right-4 -translate-y-1/2">
              anos
            </span>
          </label>
          <label className="relative">
            <span className="sr-only">Meses</span>
            <input
              data-testid="ped-meses"
              inputMode="numeric"
              value={meses}
              onChange={(e) => {
                setMeses(e.target.value);
                setConfirmouDestoante(false);
              }}
              placeholder="0"
              className={`${campo} h-12 pr-16 text-lg font-bold tabular-nums`}
            />
            <span className="t-label text-muted-foreground pointer-events-none absolute top-1/2 right-4 -translate-y-1/2">
              meses
            </span>
          </label>
        </div>
        {estimado !== null && (
          <button
            type="button"
            data-testid="ped-usar-estimado"
            onClick={() => {
              setPesoTxt(String(estimado).replace(".", ","));
              setUsouEstimado(true);
            }}
            className="touch-target border-border text-foreground hover:bg-accent focus-visible:ring-ring t-body flex items-center gap-2 rounded-2xl border border-dashed px-4 text-left focus-visible:ring-2 focus-visible:outline-none"
          >
            <Scale className="text-muted-foreground h-5 w-5 shrink-0" aria-hidden="true" />
            Sem balança? Usar {String(estimado).replace(".", ",")} kg estimados para{" "}
            {descreverIdade(idade!)}
          </button>
        )}
      </fieldset>

      <label className="grid gap-1">
        <span className="t-label text-muted-foreground">
          Altura em cm (opcional, melhora a superfície corporal)
        </span>
        <input
          inputMode="numeric"
          value={alturaTxt}
          onChange={(e) => setAlturaTxt(e.target.value)}
          className={`${campo} h-12 text-lg font-bold tabular-nums`}
        />
      </label>

      {peso !== null && !valido && (
        <p role="alert" className="t-body text-destructive">
          O peso precisa estar entre {PESO_MIN} e {PESO_MAX} kg.
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
              ? `Confira: ${pesoTxt} kg para ${descreverIdade(idade!)}? O esperado é perto de ${String(estimado).replace(".", ",")} kg.`
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
        className="bg-primary text-primary-foreground focus-visible:ring-ring h-14 rounded-2xl text-lg font-bold transition-opacity focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-40"
      >
        Calcular doses
      </button>
    </form>
  );
}
