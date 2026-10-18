import { Check, ChevronDown, Droplets, Phone, Stethoscope } from "lucide-react";
import { useState } from "react";
import {
  CAUSAS,
  PROCEDIMENTOS,
  volumeBolus,
  type Causa,
  type Procedimento,
} from "../../../shared/pediatria/causas";
import { drogaPorId } from "../../../shared/pediatria/kits";
import { DoseRapida } from "./DoseRapida";
import { PontoDescompressao, PontoPericardiocentese } from "./Ilustracoes";

function GuiaProcedimento({
  tipo,
  onRealizado,
  feito,
}: {
  tipo: Procedimento;
  onRealizado?: () => void;
  feito: boolean;
}) {
  const p = PROCEDIMENTOS[tipo];
  const [passo, setPasso] = useState(0);
  return (
    <section
      aria-label={p.titulo}
      data-testid={`ped-proc-${tipo}`}
      className="border-primary bg-primary/5 grid gap-3 rounded-3xl border-2 p-4"
    >
      <p className="t-eyebrow text-primary">Procedimento guiado</p>
      <h4 className="t-title text-foreground">{p.titulo}</h4>
      <div className="grid items-start gap-3 sm:grid-cols-[180px_1fr]">
        {tipo === "pericardiocentese" ? (
          <PontoPericardiocentese className="mx-auto w-full max-w-[200px]" />
        ) : (
          <PontoDescompressao className="mx-auto w-full max-w-[200px]" />
        )}
        <div className="grid gap-2">
          <p className="t-label text-muted-foreground">{p.material}</p>
          <ol className="grid gap-1.5">
            {p.passos.map((t, i) => (
              <li key={t}>
                <button
                  type="button"
                  onClick={() => setPasso(i + 1)}
                  aria-current={passo === i ? "step" : undefined}
                  className={`focus-visible:ring-ring grid w-full grid-cols-[2rem_1fr] items-start gap-2 rounded-2xl px-2 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none ${
                    i < passo
                      ? "text-muted-foreground"
                      : i === passo
                        ? "bg-card text-foreground shadow-sm"
                        : "text-foreground"
                  }`}
                >
                  <span
                    className={`grid h-7 w-7 place-items-center rounded-full text-sm font-black ${
                      i < passo
                        ? "bg-success text-success-foreground"
                        : i === passo
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                    }`}
                  >
                    {i < passo ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}
                  </span>
                  <span className="t-body">{t}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
      {onRealizado && (
        <button
          type="button"
          onClick={onRealizado}
          disabled={feito}
          data-testid={`ped-proc-feito-${tipo}`}
          className="bg-primary text-primary-foreground focus-visible:ring-ring h-14 rounded-2xl text-lg font-bold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
        >
          {feito ? "Procedimento registrado" : "Procedimento realizado"}
        </button>
      )}
    </section>
  );
}

function Conduta({
  causa,
  peso,
  registros,
  onRegistrar,
  onRegistrarDroga,
}: {
  causa: Causa;
  peso: number | null;
  registros: Record<string, number>;
  onRegistrar?: (texto: string) => void;
  onRegistrarDroga?: (id: string) => (texto: string) => void;
}) {
  const [procFeito, setProcFeito] = useState(false);
  return (
    <div className="grid gap-3 px-1 pb-2">
      <div className="bg-muted rounded-2xl p-3">
        <p className="t-label text-muted-foreground mb-1 flex items-center gap-1.5">
          <Stethoscope className="h-4 w-4" aria-hidden="true" /> Pistas
        </p>
        <ul className="t-body text-foreground grid list-disc gap-0.5 pl-5">
          {causa.pistas.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>

      <ol className="grid gap-2">
        {causa.passos.map((p, i) => (
          <li key={p} className="t-body text-foreground grid grid-cols-[1.75rem_1fr] gap-2">
            <span className="bg-foreground text-background grid h-7 w-7 place-items-center rounded-full text-sm font-black">
              {i + 1}
            </span>
            <span>
              {p.includes("0800 722 6001") ? (
                <>
                  {p.replace("0800 722 6001.", "")}
                  <a
                    href="tel:08007226001"
                    className="text-primary inline-flex items-center gap-1 font-bold underline"
                  >
                    <Phone className="h-4 w-4" aria-hidden="true" /> 0800 722 6001
                  </a>
                </>
              ) : (
                p
              )}
            </span>
          </li>
        ))}
      </ol>

      {causa.procedimento && (
        <GuiaProcedimento
          tipo={causa.procedimento}
          feito={procFeito}
          onRealizado={
            onRegistrar
              ? () => {
                  setProcFeito(true);
                  onRegistrar(
                    `Conduta: ${PROCEDIMENTOS[causa.procedimento!].titulo.toLowerCase()} realizada`,
                  );
                }
              : undefined
          }
        />
      )}

      {causa.volumes?.map((v) => (
        <div
          key={v.nome}
          className="bg-card border-border grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-3xl border p-4"
        >
          <span className="bg-primary/10 text-primary grid h-11 w-11 place-items-center rounded-2xl">
            <Droplets className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="t-body text-foreground font-bold">{v.nome}</p>
            <p className="t-label text-muted-foreground">
              {v.mlPorKg} mL/kg{v.nota ? ` · ${v.nota}` : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-primary text-3xl leading-none font-black tabular-nums">
              {peso ? volumeBolus(v.mlPorKg, peso) : "—"}
              <span className="ml-1 text-base font-bold">mL</span>
            </p>
            {onRegistrar && peso && (
              <button
                type="button"
                onClick={() =>
                  onRegistrar(`${v.nome}: ${volumeBolus(v.mlPorKg, peso)} mL (${v.mlPorKg} mL/kg)`)
                }
                className="t-label text-primary min-h-11 underline-offset-4 hover:underline"
              >
                Registrar
              </button>
            )}
          </div>
        </div>
      ))}

      {causa.drogas && (
        <ul className="grid gap-3">
          {causa.drogas.map((d) => (
            <DoseRapida
              key={d.id}
              item={{ droga: drogaPorId(d.id), papel: d.papel }}
              peso={peso}
              vezes={registros[d.id] ?? 0}
              onRegistrar={onRegistrarDroga?.(d.id)}
            />
          ))}
        </ul>
      )}

      {causa.antidotos && (
        <div className="grid gap-2">
          <p className="t-eyebrow text-muted-foreground">Antídotos — doses pediátricas</p>
          <ul className="grid gap-3">
            {causa.antidotos.map((a) => (
              <DoseRapida
                key={a.agente}
                item={{ droga: drogaPorId(a.drogaId), papel: a.agente }}
                peso={peso}
                vezes={registros[a.drogaId] ?? 0}
                onRegistrar={onRegistrarDroga?.(a.drogaId)}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Os 6 Hs e 5 Ts: marcar as hipóteses e seguir a conduta de cada uma. As
 * marcadas sobem para o topo da lista; toda ação pode ir para o registro.
 */
export function CausasReversiveis({
  peso,
  hipoteses,
  onHipotese,
  registros = {},
  onRegistrar,
  onRegistrarDroga,
}: {
  peso: number | null;
  hipoteses: string[];
  onHipotese: (nome: string, marcada: boolean) => void;
  registros?: Record<string, number>;
  onRegistrar?: (texto: string) => void;
  onRegistrarDroga?: (id: string) => (texto: string) => void;
}) {
  const [aberta, setAberta] = useState<string | null>(null);
  const marcadas = new Set(hipoteses);
  const ordenadas = [...CAUSAS].sort(
    (a, b) => Number(marcadas.has(b.nome)) - Number(marcadas.has(a.nome)),
  );

  return (
    <div className="grid gap-4">
      {(["H", "T"] as const).map((g) => {
        const lista = ordenadas.filter((c) => c.grupo === g);
        return (
          <section key={g} aria-label={g === "H" ? "6 Hs" : "5 Ts"} className="grid gap-2">
            <p className="t-eyebrow text-muted-foreground">{g === "H" ? "6 Hs" : "5 Ts"}</p>
            <ul className="grid gap-2">
              {lista.map((c) => {
                const marcada = marcadas.has(c.nome);
                const expandida = aberta === c.id;
                return (
                  <li
                    key={c.id}
                    data-testid={`ped-causa-${c.id}`}
                    className={`rounded-3xl border-2 ${marcada ? "border-destructive bg-destructive/5" : "border-border bg-card"}`}
                  >
                    <div className="flex items-center gap-2 p-2">
                      <label className="flex min-h-12 min-w-12 items-center justify-center">
                        <span className="sr-only">Marcar {c.nome} como hipótese</span>
                        <input
                          type="checkbox"
                          checked={marcada}
                          data-testid={`ped-hipotese-${c.id}`}
                          onChange={(e) => {
                            onHipotese(c.nome, e.target.checked);
                            if (e.target.checked) setAberta(c.id);
                          }}
                          className="accent-destructive h-6 w-6"
                        />
                      </label>
                      <button
                        type="button"
                        aria-expanded={expandida}
                        data-testid={`ped-conduta-${c.id}`}
                        onClick={() => setAberta(expandida ? null : c.id)}
                        className="focus-visible:ring-ring flex min-h-12 flex-1 items-center justify-between gap-2 rounded-2xl px-2 text-left focus-visible:ring-2 focus-visible:outline-none"
                      >
                        <span className="min-w-0">
                          <span className="t-body text-foreground block font-bold">{c.nome}</span>
                          {marcada && <span className="t-label text-destructive">Hipótese</span>}
                        </span>
                        <span className="t-label text-primary flex shrink-0 items-center gap-1">
                          Conduta
                          <ChevronDown
                            className={`h-5 w-5 transition-transform ${expandida ? "rotate-180" : ""}`}
                            aria-hidden="true"
                          />
                        </span>
                      </button>
                    </div>
                    {expandida && (
                      <div className="px-3 pb-2">
                        <Conduta
                          causa={c}
                          peso={peso}
                          registros={registros}
                          onRegistrar={onRegistrar}
                          onRegistrarDroga={onRegistrarDroga}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {peso === null && (
        <p className="t-label text-muted-foreground">Informe o peso para ver volumes e doses.</p>
      )}
      <p className="t-label text-muted-foreground">Referência: PALS.</p>
    </div>
  );
}
