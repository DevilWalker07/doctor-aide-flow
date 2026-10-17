/**
 * Modo RCP: tela cheia, para o líder da equipe na sala vermelha. Metrônomo
 * com som a 110/min, ciclos de 2 min com alarme de checagem de ritmo, carga do
 * desfibrilador, janela da adrenalina e registro de tudo com horário.
 */
import { Check, ChevronDown, Copy, HeartPulse, Volume2, VolumeX, Wind, X, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  calcularBolus,
  energiaDesfibrilacaoN,
  formatarMl,
  formatarNumero,
} from "../../../shared/pediatria/calculos";
import { DROGAS_BOLUS } from "../../../shared/pediatria/drogas";
import {
  ADRENALINA_MAX_MS,
  ADRENALINA_MIN_MS,
  CAUSAS_REVERSIVEIS,
  CICLO_MS,
  COMPRESSOES_POR_MINUTO,
  VENTILACAO_VA_MS,
  estadoAdrenalina,
  formatarTempo,
  sugestoes,
  type Relacao,
  type Ritmo,
} from "../../../shared/pediatria/pcr";
import { Metronomo, Sons, type Batida } from "@/lib/pediatria/som";
import { Desfibrilador } from "./Ilustracoes";

type Fase = "rcp" | "checagem" | "choque" | "rce";
interface Evento {
  t: number;
  texto: string;
}

const droga = (id: string) => DROGAS_BOLUS.find((d) => d.id === id)!;

function useWakeLock(ativo: boolean) {
  useEffect(() => {
    if (!ativo || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelado = false;
    navigator.wakeLock
      .request("screen")
      .then((l) => {
        if (cancelado) void l.release();
        else lock = l;
      })
      .catch(() => {});
    return () => {
      cancelado = true;
      void lock?.release();
    };
  }, [ativo]);
}

export function ModoPcr({ peso, sons, onSair }: { peso: number; sons: Sons; onSair: () => void }) {
  const [inicio] = useState(() => Date.now());
  const [agora, setAgora] = useState(() => Date.now());
  const [cicloInicio, setCicloInicio] = useState(() => Date.now());
  const [fase, setFase] = useState<Fase>("rcp");
  const [relacao, setRelacao] = useState<Relacao>("15:2");
  const [mudo, setMudo] = useState(false);
  const [batida, setBatida] = useState<Batida | null>(null);
  const [eventos, setEventos] = useState<Evento[]>(() => [{ t: 0, texto: "RCP iniciada" }]);
  const [choques, setChoques] = useState(0);
  const [adrenalinas, setAdrenalinas] = useState(0);
  const [ultimaAdrenalina, setUltimaAdrenalina] = useState<number | null>(null);
  const [amiodaronas, setAmiodaronas] = useState(0);
  const [ritmo, setRitmo] = useState<Ritmo | null>(null);
  const [carga, setCarga] = useState<"vazia" | "carregando" | "pronta">("vazia");
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const [verCausas, setVerCausas] = useState(false);
  const metro = useRef<Metronomo | null>(null);
  const avisouAdrenalina = useRef(false);

  useWakeLock(fase !== "rce");

  const decorrido = agora - inicio;
  const noCiclo = agora - cicloInicio;
  const restaCiclo = CICLO_MS - noCiclo;
  const desdeAdrenalina = ultimaAdrenalina === null ? null : agora - ultimaAdrenalina;
  const adr = estadoAdrenalina(desdeAdrenalina);
  const adrBolus = calcularBolus(droga("adrenalina-iv"), peso);
  const amioBolus = calcularBolus(droga("amiodarona"), peso);
  const proximoChoque = energiaDesfibrilacaoN(choques + 1, peso);

  const registrar = useCallback(
    (texto: string) => setEventos((ev) => [...ev, { t: Date.now() - inicio, texto }]),
    [inicio],
  );

  // relógio
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  // metrônomo liga na RCP (inclusive enquanto o desfibrilador carrega) e para na checagem
  useEffect(() => {
    sons.mudo = mudo;
  }, [mudo, sons]);
  useEffect(() => {
    if (!metro.current) metro.current = new Metronomo(sons, setBatida);
    const m = metro.current;
    if (fase === "rcp" || (fase === "choque" && carga !== "pronta")) {
      const padrao =
        relacao === "continua"
          ? ("continuo" as const)
          : { compressoes: relacao === "15:2" ? 15 : 30, ventilacoes: 2 };
      m.iniciar(COMPRESSOES_POR_MINUTO, padrao, VENTILACAO_VA_MS);
    } else {
      m.parar();
      setBatida(null);
    }
    return () => m.parar();
  }, [fase, relacao, carga, sons]);

  // fim do ciclo de 2 min → checagem de ritmo
  useEffect(() => {
    if (fase === "rcp" && restaCiclo <= 0) {
      setFase("checagem");
      sons.alarme();
      navigator.vibrate?.([200, 100, 200, 100, 200]);
      registrar("Checagem de ritmo");
    }
  }, [fase, restaCiclo, sons, registrar]);

  // lembrete quando a janela da adrenalina abre
  useEffect(() => {
    if (ultimaAdrenalina === null) return;
    if (
      desdeAdrenalina !== null &&
      desdeAdrenalina >= ADRENALINA_MIN_MS &&
      !avisouAdrenalina.current
    ) {
      avisouAdrenalina.current = true;
      sons.lembrete();
    }
  }, [desdeAdrenalina, ultimaAdrenalina, sons]);

  const novoCiclo = () => {
    setCicloInicio(Date.now());
    setFase("rcp");
  };

  const escolherRitmo = (r: Ritmo | "rce") => {
    if (r === "rce") {
      setFase("rce");
      registrar("Retorno da circulação espontânea (RCE)");
      return;
    }
    setRitmo(r);
    registrar(
      r === "chocavel" ? "Ritmo chocável (FV/TVSP)" : "Ritmo não chocável (AESP/assistolia)",
    );
    if (r === "chocavel") {
      setCarga("vazia");
      setFase("choque");
    } else {
      novoCiclo();
    }
  };

  const carregar = async () => {
    setCarga("carregando");
    registrar(`Carregando ${proximoChoque.joules} J`);
    await sons.carregar(2500);
    setCarga("pronta");
    sons.prontoParaChocar();
  };

  const chocar = () => {
    sons.choque();
    navigator.vibrate?.(300);
    setChoques((c) => c + 1);
    registrar(
      `Choque ${choques + 1}: ${proximoChoque.joules} J (${formatarNumero(proximoChoque.jPorKg, 0)} J/kg)`,
    );
    setCarga("vazia");
    novoCiclo();
  };

  const darAdrenalina = () => {
    setAdrenalinas((n) => n + 1);
    setUltimaAdrenalina(Date.now());
    avisouAdrenalina.current = false;
    registrar(
      `Adrenalina ${adrenalinas + 1}: ${formatarNumero(adrBolus.dose, 3)} mg (${formatarMl(adrBolus.volumeMl)} mL de 0,1 mg/mL)`,
    );
  };

  const darAmiodarona = () => {
    setAmiodaronas((n) => n + 1);
    registrar(
      `Amiodarona ${amiodaronas + 1}: ${formatarNumero(amioBolus.dose, 1)} mg (${formatarMl(amioBolus.volumeMl)} mL)`,
    );
  };

  const trocarRelacao = (r: Relacao) => {
    setRelacao(r);
    registrar(r === "continua" ? "Via aérea avançada: compressões contínuas" : `Relação ${r}`);
  };

  const registroTexto = () =>
    [
      `RCP pediátrica — ${formatarNumero(peso, 1)} kg — início ${new Date(inicio).toLocaleTimeString("pt-BR")}`,
      ...eventos.map((e) => `${formatarTempo(e.t)}  ${e.texto}`),
      `Total: ${formatarTempo(decorrido)} · ${choques} choque(s) · ${adrenalinas} adrenalina(s) · ${amiodaronas} amiodarona(s)`,
    ].join("\n");

  const copiarRegistro = async () => {
    try {
      await navigator.clipboard.writeText(registroTexto());
      toast.success("Registro copiado");
    } catch {
      toast.error("Não consegui copiar o registro.");
    }
  };

  const sair = () => {
    metro.current?.parar();
    onSair();
  };

  const sugeridas =
    ritmo === null
      ? []
      : sugestoes({
          ritmo,
          choques,
          adrenalinas,
          amiodaronas,
          adrenalinaLiberada: adr !== "aguardando",
        });

  const progresso = Math.min(1, Math.max(0, noCiclo / CICLO_MS));
  const R = 88;
  const C = 2 * Math.PI * R;
  const ventilando = batida?.tipo === "ventilacao";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Modo RCP"
      data-testid="ped-modo-pcr"
      className="bg-background fixed inset-0 z-50 overflow-y-auto"
    >
      {/* barra superior */}
      <header className="bg-navy text-navy-foreground sticky top-0 z-10 flex items-center gap-3 px-4 py-3">
        <HeartPulse className="text-destructive h-6 w-6 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="t-label opacity-80">
            {fase === "rce" ? "RCP encerrada" : "RCP em andamento"} · {formatarNumero(peso, 1)} kg
          </p>
          <p
            className="text-2xl leading-none font-extrabold tabular-nums"
            data-testid="ped-pcr-total"
          >
            {formatarTempo(decorrido)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMudo((m) => !m)}
          aria-label={mudo ? "Ligar som" : "Desligar som"}
          aria-pressed={!mudo}
          className="touch-target focus-visible:ring-ring inline-flex items-center justify-center rounded-2xl bg-white/10 focus-visible:ring-2 focus-visible:outline-none"
        >
          {mudo ? (
            <VolumeX className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Volume2 className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
        {confirmarSaida || fase === "rce" ? (
          <button
            type="button"
            onClick={sair}
            data-testid="ped-pcr-sair"
            className="touch-target bg-destructive text-destructive-foreground focus-visible:ring-ring rounded-2xl px-4 font-bold focus-visible:ring-2 focus-visible:outline-none"
          >
            {fase === "rce" ? "Fechar" : "Encerrar mesmo"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmarSaida(true)}
            aria-label="Encerrar RCP"
            className="touch-target focus-visible:ring-ring inline-flex items-center justify-center rounded-2xl bg-white/10 focus-visible:ring-2 focus-visible:outline-none"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </header>

      <main className="mx-auto grid max-w-5xl gap-4 px-4 py-4 lg:grid-cols-[1fr_360px]">
        <div className="grid content-start gap-4">
          {/* compressões */}
          {(fase === "rcp" || fase === "choque") && (
            <section
              aria-label="Compressões"
              className="bg-card border-border grid justify-items-center gap-3 rounded-3xl border p-4"
            >
              <div className="relative h-56 w-56">
                <svg
                  viewBox="0 0 200 200"
                  className="absolute inset-0 h-full w-full -rotate-90"
                  aria-hidden="true"
                >
                  <circle
                    cx="100"
                    cy="100"
                    r={R}
                    fill="none"
                    stroke="var(--muted)"
                    strokeWidth="10"
                  />
                  <circle
                    cx="100"
                    cy="100"
                    r={R}
                    fill="none"
                    stroke={restaCiclo < 15_000 ? "var(--warning)" : "var(--primary)"}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={C}
                    strokeDashoffset={C * (1 - progresso)}
                    style={{ transition: "stroke-dashoffset 0.25s linear" }}
                  />
                </svg>
                <div
                  key={batida ? `${batida.tipo}-${batida.n}` : "parado"}
                  className={`absolute inset-6 grid place-items-center rounded-full ${
                    ventilando ? "bg-primary/15" : "bg-destructive/15"
                  } ${batida ? "ped-batida" : ""}`}
                  style={{ ["--ped-ciclo" as string]: "0.5s", animationIterationCount: 1 }}
                >
                  <div className="text-center">
                    {ventilando ? (
                      <>
                        <Wind className="text-primary mx-auto h-10 w-10" aria-hidden="true" />
                        <p className="text-primary text-2xl font-extrabold">Ventile</p>
                      </>
                    ) : (
                      <>
                        <p
                          className="text-destructive text-6xl leading-none font-extrabold tabular-nums"
                          data-testid="ped-pcr-contagem"
                        >
                          {batida?.tipo === "compressao" ? (batida.total ? batida.n : "•") : "—"}
                        </p>
                        <p className="t-label text-muted-foreground mt-1">
                          {batida?.tipo === "compressao" && batida.total
                            ? `de ${batida.total}`
                            : "Comprima"}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <p className="t-body text-foreground text-center tabular-nums">
                Checar ritmo em <strong>{formatarTempo(restaCiclo)}</strong>
              </p>
              <p className="t-label text-muted-foreground text-center">
                {COMPRESSOES_POR_MINUTO}/min · afundar 1/3 do tórax · retorno total · trocar quem
                comprime a cada 2 min
              </p>
              <div
                className="bg-muted flex w-full max-w-md rounded-2xl p-1"
                role="group"
                aria-label="Relação compressão-ventilação"
              >
                {(
                  [
                    ["15:2", "15:2"],
                    ["30:2", "30:2"],
                    ["continua", "Via aérea avançada"],
                  ] as const
                ).map(([r, rotulo]) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={relacao === r}
                    onClick={() => trocarRelacao(r)}
                    className={`touch-target t-label flex-1 rounded-xl px-2 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none ${
                      relacao === r ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* checagem de ritmo */}
          {fase === "checagem" && (
            <section
              aria-label="Checagem de ritmo"
              className="border-warning bg-warning/10 grid gap-3 rounded-3xl border-2 p-4"
            >
              <p className="t-title text-foreground">
                Pare as compressões. Ritmo e pulso em até 10 s.
              </p>
              <button
                type="button"
                data-testid="ped-ritmo-chocavel"
                onClick={() => escolherRitmo("chocavel")}
                className="bg-destructive text-destructive-foreground focus-visible:ring-ring h-16 rounded-2xl text-lg font-bold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Chocável · FV ou TV sem pulso
              </button>
              <button
                type="button"
                data-testid="ped-ritmo-nao-chocavel"
                onClick={() => escolherRitmo("nao-chocavel")}
                className="bg-foreground text-background focus-visible:ring-ring h-16 rounded-2xl text-lg font-bold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Não chocável · AESP ou assistolia
              </button>
              <button
                type="button"
                onClick={() => escolherRitmo("rce")}
                className="bg-success text-success-foreground focus-visible:ring-ring h-14 rounded-2xl text-lg font-bold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Pulso presente · RCE
              </button>
            </section>
          )}

          {/* choque */}
          {fase === "choque" && (
            <section
              aria-label="Desfibrilação"
              className="bg-card border-warning grid gap-3 rounded-3xl border-2 p-4"
            >
              <div className="flex items-center gap-4">
                <Desfibrilador
                  joules={proximoChoque.joules}
                  carga={carga === "vazia" ? 0 : 1}
                  className="text-foreground/80 w-36 shrink-0"
                />
                <div>
                  <p className="t-title text-foreground">
                    {choques + 1}º choque: {proximoChoque.joules} J
                  </p>
                  <p className="t-label text-muted-foreground">
                    {formatarNumero(proximoChoque.jPorKg, 0)} J/kg
                    {proximoChoque.atingiuTeto ? " · limitado a 200 J" : ""}. Continue comprimindo
                    enquanto carrega.
                  </p>
                </div>
              </div>
              {carga !== "pronta" ? (
                <button
                  type="button"
                  data-testid="ped-carregar"
                  disabled={carga === "carregando"}
                  onClick={carregar}
                  className="bg-warning text-warning-foreground focus-visible:ring-ring h-16 rounded-2xl text-lg font-bold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
                >
                  {carga === "carregando" ? "Carregando…" : `Carregar ${proximoChoque.joules} J`}
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="ped-chocar"
                  onClick={chocar}
                  className="bg-destructive text-destructive-foreground focus-visible:ring-ring relative h-16 overflow-visible rounded-2xl text-lg font-bold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <span
                    className="ped-anel border-destructive pointer-events-none absolute inset-0 rounded-2xl border-4"
                    aria-hidden="true"
                  />
                  <Zap className="mr-2 inline h-6 w-6" aria-hidden="true" />
                  Afastem-se! Chocar
                </button>
              )}
            </section>
          )}

          {/* RCE */}
          {fase === "rce" && (
            <section
              aria-label="Resumo"
              className="border-success bg-success/10 grid gap-3 rounded-3xl border-2 p-4"
            >
              <p className="t-title text-foreground">RCE às {formatarTempo(decorrido)}</p>
              <p className="t-body text-foreground">
                Cuidados pós-PCR: oxigenação e ventilação, PA acima do mínimo para a idade,
                glicemia, temperatura e ECG de 12 derivações.
              </p>
              <button
                type="button"
                onClick={copiarRegistro}
                className="touch-target bg-card border-border text-foreground focus-visible:ring-ring inline-flex items-center justify-center gap-2 rounded-2xl border font-semibold focus-visible:ring-2 focus-visible:outline-none"
              >
                <Copy className="h-5 w-5" aria-hidden="true" /> Copiar registro
              </button>
            </section>
          )}

          {sugeridas.length > 0 && fase !== "rce" && (
            <section
              aria-label="Próximos passos"
              className="bg-card border-border rounded-3xl border p-4"
            >
              <ul className="grid gap-2">
                {sugeridas.map((s) => (
                  <li key={s} className="t-body text-foreground flex gap-2">
                    <Check className="text-primary mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                    {s}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* medicações e registro */}
        <aside className="grid content-start gap-4">
          <section
            aria-label="Medicações"
            className="bg-card border-border grid gap-3 rounded-3xl border p-4"
          >
            <button
              type="button"
              data-testid="ped-dar-adrenalina"
              disabled={fase === "rce"}
              onClick={darAdrenalina}
              className={`focus-visible:ring-ring grid gap-0.5 rounded-2xl border-2 px-4 py-3 text-left focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50 ${
                adr === "atrasada"
                  ? "border-destructive bg-destructive/10 ped-alerta"
                  : adr === "pode"
                    ? "border-primary bg-primary/10"
                    : "border-border"
              }`}
            >
              <span className="t-title text-foreground">
                Adrenalina · {formatarMl(adrBolus.volumeMl)} mL
              </span>
              <span className="t-label text-muted-foreground">
                {formatarNumero(adrBolus.dose, 3)} mg · 1 mL + 9 mL AD (0,1 mg/mL)
              </span>
              <span className="t-label text-foreground tabular-nums">
                {desdeAdrenalina === null
                  ? "Nenhuma dose ainda — toque ao administrar"
                  : adr === "aguardando"
                    ? `Próxima em ${formatarTempo(ADRENALINA_MIN_MS - desdeAdrenalina)}`
                    : adr === "pode"
                      ? `Liberada · limite em ${formatarTempo(ADRENALINA_MAX_MS - desdeAdrenalina)}`
                      : `Atrasada há ${formatarTempo(desdeAdrenalina - ADRENALINA_MAX_MS)}`}
                {adrenalinas > 0 ? ` · ${adrenalinas} dose(s)` : ""}
              </span>
            </button>
            <button
              type="button"
              data-testid="ped-dar-amiodarona"
              disabled={fase === "rce" || amiodaronas >= 3}
              onClick={darAmiodarona}
              className={`focus-visible:ring-ring grid gap-0.5 rounded-2xl border-2 px-4 py-3 text-left focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50 ${
                ritmo === "chocavel" && choques >= 3 && amiodaronas < 3
                  ? "border-primary bg-primary/10"
                  : "border-border"
              }`}
            >
              <span className="t-title text-foreground">
                Amiodarona · {formatarMl(amioBolus.volumeMl)} mL
              </span>
              <span className="t-label text-muted-foreground">
                {formatarNumero(amioBolus.dose, 1)} mg · após o 3º choque · {amiodaronas}/3 doses
              </span>
            </button>
          </section>

          <section
            aria-label="Causas reversíveis"
            className="bg-card border-border rounded-3xl border p-4"
          >
            <button
              type="button"
              aria-expanded={verCausas}
              onClick={() => setVerCausas((v) => !v)}
              className="touch-target text-foreground focus-visible:ring-ring flex w-full items-center justify-between rounded-xl focus-visible:ring-2 focus-visible:outline-none"
            >
              <span className="t-title">Hs e Ts</span>
              <ChevronDown
                className={`h-5 w-5 transition-transform ${verCausas ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>
            {verCausas && (
              <div className="mt-2 grid grid-cols-2 gap-3">
                {(["H", "T"] as const).map((k) => (
                  <ul key={k} className="grid gap-1">
                    {CAUSAS_REVERSIVEIS[k].map((c) => (
                      <li key={c}>
                        <label className="t-body text-foreground flex min-h-11 items-center gap-2">
                          <input type="checkbox" className="accent-primary h-5 w-5 shrink-0" />
                          {c}
                        </label>
                      </li>
                    ))}
                  </ul>
                ))}
              </div>
            )}
          </section>

          <section aria-label="Registro" className="bg-card border-border rounded-3xl border p-4">
            <div className="flex items-center justify-between">
              <h2 className="t-title text-foreground">Registro</h2>
              <button
                type="button"
                onClick={copiarRegistro}
                aria-label="Copiar registro"
                className="touch-target text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center justify-center rounded-xl focus-visible:ring-2 focus-visible:outline-none"
              >
                <Copy className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <ol className="mt-2 grid gap-1" data-testid="ped-pcr-registro">
              {[...eventos].reverse().map((e, i) => (
                <li key={`${e.t}-${i}`} className="t-body text-foreground flex gap-3 tabular-nums">
                  <span className="text-muted-foreground shrink-0">{formatarTempo(e.t)}</span>
                  {e.texto}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </main>
    </div>
  );
}
