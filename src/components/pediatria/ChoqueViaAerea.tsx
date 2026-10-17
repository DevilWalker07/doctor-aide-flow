import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import {
  CARGAS_CARDIOVERSAO,
  CARGAS_DESFIBRILACAO,
  energiaChoque,
  formatarNumero,
  superficieCorporal,
} from "../../../shared/pediatria/calculos";
import { pasMinima, sinaisVitais, type Faixa } from "../../../shared/pediatria/sinaisVitais";
import { viaAerea } from "../../../shared/pediatria/viaAerea";
import { Coracao, Desfibrilador, Laringoscopio, Pulmoes, Tubo } from "./Ilustracoes";
import type { Paciente } from "./Identificacao";

type Modo = "desfibrilacao" | "cardioversao";

function Choque({ peso }: { peso: number }) {
  const [modo, setModo] = useState<Modo>("desfibrilacao");
  const [passo, setPasso] = useState(0);
  const cargas = modo === "desfibrilacao" ? CARGAS_DESFIBRILACAO : CARGAS_CARDIOVERSAO;
  const atual = energiaChoque(cargas.at(passo) ?? cargas[0], peso);

  return (
    <section
      aria-labelledby="ped-choque"
      className="bg-card border-border grid gap-4 rounded-3xl border p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ped-choque" className="t-title text-foreground">
          Choque (bifásico)
        </h2>
        <div className="bg-muted flex rounded-2xl p-1" role="group" aria-label="Tipo de choque">
          {(["desfibrilacao", "cardioversao"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={modo === m}
              onClick={() => {
                setModo(m);
                setPasso(0);
              }}
              className={`touch-target t-label rounded-xl px-3 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none ${
                modo === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {m === "desfibrilacao" ? "Desfibrilação" : "Cardioversão"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid items-center gap-4 sm:grid-cols-[180px_1fr]">
        <Desfibrilador
          joules={atual.joules}
          carga={(passo + 1) / cargas.length}
          className="text-foreground/80 w-full max-w-[200px]"
        />
        <ol className="grid gap-2" aria-label="Escada de cargas">
          {cargas.map((j, i) => {
            const e = energiaChoque(j, peso);
            const feito = i < passo;
            const agora = i === passo;
            return (
              <li key={j}>
                <button
                  type="button"
                  onClick={() => setPasso(i)}
                  aria-current={agora ? "step" : undefined}
                  className={`touch-target focus-visible:ring-ring flex w-full items-center justify-between rounded-2xl border px-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                    agora
                      ? "border-warning bg-warning/15 text-foreground"
                      : feito
                        ? "border-border text-muted-foreground line-through"
                        : "border-border text-foreground"
                  }`}
                >
                  <span className="t-body">
                    {i + 1}º choque · {formatarNumero(j, 1)} J/kg
                  </span>
                  <span className="text-xl font-extrabold tabular-nums">{e.joules} J</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      {atual.atingiuTeto && (
        <p className="t-body text-foreground flex gap-2">
          <AlertTriangle className="text-warning h-5 w-5 shrink-0" aria-hidden="true" />
          Limitado a 200 J, carga máxima usual do aparelho.
        </p>
      )}
      <button
        type="button"
        disabled={passo >= cargas.length - 1}
        onClick={() => setPasso((p) => Math.min(cargas.length - 1, p + 1))}
        className="bg-foreground text-background focus-visible:ring-ring h-12 rounded-2xl font-bold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-40"
      >
        Próximo choque
      </button>
    </section>
  );
}

function Regua({ rotulo, faixa, unidade }: { rotulo: string; faixa: Faixa; unidade: string }) {
  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between">
        <span className="t-label text-muted-foreground">{rotulo}</span>
        <span className="t-body text-foreground font-bold tabular-nums">
          {faixa[0]}–{faixa[1]}{" "}
          <span className="t-label text-muted-foreground font-medium">{unidade}</span>
        </span>
      </div>
      <div className="bg-muted relative h-2 rounded-full" aria-hidden="true">
        <div className="bg-success/70 absolute inset-y-0 right-[20%] left-[20%] rounded-full" />
      </div>
    </div>
  );
}

export function ChoqueViaAerea({ paciente }: { paciente: Paciente }) {
  const { peso, idade, alturaCm } = paciente;
  const va = idade ? viaAerea(idade) : null;
  const sv = idade ? sinaisVitais(idade) : null;
  const sc = superficieCorporal(peso, alturaCm);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Choque peso={peso} />

      <section
        aria-labelledby="ped-via"
        className="bg-card border-border grid content-start gap-4 rounded-3xl border p-4"
      >
        <h2 id="ped-via" className="t-title text-foreground">
          Via aérea
        </h2>
        {va ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid justify-items-center gap-1 text-center">
                <Tubo diametro={va.tuboComCuff} className="text-foreground/80 h-16 w-24" />
                <p className="text-2xl font-extrabold tabular-nums">
                  {formatarNumero(va.tuboComCuff, 1)}
                </p>
                <p className="t-label text-muted-foreground">Tubo com cuff (mm)</p>
                <p className="t-label text-muted-foreground">
                  sem cuff: {formatarNumero(va.tuboSemCuff, 1)}
                </p>
              </div>
              <div className="grid justify-items-center gap-1 text-center">
                <Laringoscopio
                  curva={va.lamina.tipo !== "Reta"}
                  className="text-foreground/80 h-16 w-24"
                />
                <p className="text-2xl font-extrabold tabular-nums">{va.lamina.numero}</p>
                <p className="t-label text-muted-foreground">
                  Lâmina {va.lamina.tipo.toLowerCase()}
                </p>
              </div>
            </div>
            <p className="t-body text-foreground">
              Fixar em cerca de{" "}
              <strong className="tabular-nums">{formatarNumero(va.profundidadeCm, 1)} cm</strong> no
              lábio. Tenha à mão um tubo 0,5 mm acima e abaixo.
            </p>
            {va.avisoNeonato && (
              <p className="t-body text-foreground flex gap-2">
                <AlertTriangle className="text-warning h-5 w-5 shrink-0" aria-hidden="true" />
                Neonato: escolha o tubo pelo peso e idade gestacional.
              </p>
            )}
          </>
        ) : (
          <p className="t-body text-muted-foreground">Informe a idade para ver tubo e lâmina.</p>
        )}
        <p className="t-body text-foreground border-border border-t pt-3">
          Superfície corporal: <strong className="tabular-nums">{formatarNumero(sc, 2)} m²</strong>
          <span className="t-label text-muted-foreground">
            {" "}
            {alturaCm ? "(Mosteller)" : "(pelo peso)"}
          </span>
        </p>
      </section>

      <section
        aria-labelledby="ped-sv"
        className="bg-card border-border grid content-start gap-4 rounded-3xl border p-4 lg:col-span-2"
      >
        <h2 id="ped-sv" className="t-title text-foreground">
          Sinais vitais normais{sv ? ` · ${sv.faixaEtaria}` : ""}
        </h2>
        {sv && idade ? (
          <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="flex justify-center gap-6">
              <Coracao bpm={(sv.fc[0] + sv.fc[1]) / 2} className="h-14 w-14" />
              <Pulmoes irpm={(sv.fr[0] + sv.fr[1]) / 2} className="text-foreground/70 h-14 w-14" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Regua rotulo="Frequência cardíaca" faixa={sv.fc} unidade="bpm" />
              <Regua rotulo="Frequência respiratória" faixa={sv.fr} unidade="irpm" />
              <Regua rotulo="PA sistólica" faixa={sv.pas} unidade="mmHg" />
              <Regua rotulo="PA diastólica" faixa={sv.pad} unidade="mmHg" />
              <Regua rotulo="PA média" faixa={sv.pam} unidade="mmHg" />
              <p className="t-body text-foreground self-end">
                Hipotensão: PAS abaixo de{" "}
                <strong className="tabular-nums">{pasMinima(idade)} mmHg</strong>
              </p>
            </div>
          </div>
        ) : (
          <p className="t-body text-muted-foreground">
            Informe a idade para ver as faixas normais.
          </p>
        )}
      </section>
    </div>
  );
}
