/**
 * Modo RCP: tela cheia, para o líder da equipe na sala vermelha. Metrônomo
 * com som a 110/min, ciclos de 2 min com alarme de checagem de ritmo,
 * desfibrilação, cardioversão sincronizada, intubação, sedoanalgesia, janela
 * da adrenalina e registro de tudo com horário. Começa mesmo sem peso: o
 * metrônomo não precisa dele; as doses aparecem quando o peso entra.
 */
import {
  Activity,
  Check,
  Copy,
  FlaskConical,
  HeartPulse,
  FileDown,
  ListChecks,
  Moon,
  RefreshCw,
  Users,
  Scale,
  Syringe,
  Volume2,
  VolumeX,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  CARGAS_CARDIOVERSAO,
  calcularBolus,
  descreverIdade,
  energiaChoque,
  energiaDesfibrilacaoN,
  formatarMl,
  formatarNumero,
} from "../../../shared/pediatria/calculos";
import { DROGAS_BOLUS } from "../../../shared/pediatria/drogas";
import {
  KIT_CARDIOVERSAO,
  KIT_INTUBACAO,
  KIT_OUTRAS,
  KIT_SEDOANALGESIA,
  type ItemKit,
} from "../../../shared/pediatria/kits";
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
import { viaAerea } from "../../../shared/pediatria/viaAerea";
import { baixarRelatorioPdf, desfecho, duracao, textoRegistro } from "@/lib/pediatria/relatorioRcp";
import {
  PAPEIS,
  apagarSessao,
  comEvento,
  compressorDaVez,
  salvarSessao,
  type Equipe,
  type SessaoRcp,
} from "@/lib/pediatria/sessaoRcp";
import { Metronomo, Sons, type Batida } from "@/lib/pediatria/som";
import { DoseRapida } from "./DoseRapida";
import { Gaveta } from "./Gaveta";
import { Identificacao, type Paciente } from "./Identificacao";
import { Desfibrilador, Laringoscopio, Tubo } from "./Ilustracoes";

type Painel =
  | null
  | "peso"
  | "equipe"
  | "cardioversao"
  | "intubacao"
  | "sedoanalgesia"
  | "outras"
  | "causas";

/** Por quanto tempo o aviso "troque quem comprime" fica na tela a cada ciclo. */
const AVISO_TROCA_MS = 10_000;

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

/** Bloco de ação do painel lateral: ícone, título, uma linha de estado. */
function Acao({
  icone,
  titulo,
  linha,
  tom = "neutro",
  onClick,
  testid,
  disabled,
  largo = false,
}: {
  icone: ReactNode;
  titulo: string;
  linha: ReactNode;
  tom?: "neutro" | "primario" | "perigo" | "atencao";
  onClick: () => void;
  testid?: string;
  disabled?: boolean;
  /** Ocupa a linha inteira: ícone ao lado do texto. Meia largura: ícone em cima. */
  largo?: boolean;
}) {
  const cores = {
    neutro: "border-border bg-card",
    primario: "border-primary bg-primary/10",
    perigo: "border-destructive bg-destructive/10",
    atencao: "border-destructive bg-destructive/10 ped-alerta",
  }[tom];
  const icn = {
    neutro: "bg-muted text-foreground",
    primario: "bg-primary text-primary-foreground",
    perigo: "bg-destructive text-destructive-foreground",
    atencao: "bg-destructive text-destructive-foreground",
  }[tom];
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid}
      disabled={disabled}
      className={`focus-visible:ring-ring grid h-full w-full gap-3 rounded-3xl border-2 p-3 text-left transition-transform active:scale-[0.98] focus-visible:ring-2 focus-visible:outline-none disabled:opacity-40 ${
        largo ? "min-h-[5rem] grid-cols-[auto_1fr] items-center" : "min-h-[8.5rem] content-start"
      } ${cores}`}
    >
      <span className={`grid h-11 w-11 place-items-center rounded-2xl ${icn}`}>{icone}</span>
      <span className="min-w-0">
        <span className="t-body text-foreground block font-bold">{titulo}</span>
        <span className="t-label text-muted-foreground block font-medium tabular-nums">
          {linha}
        </span>
      </span>
    </button>
  );
}

export function ModoPcr({
  sessaoInicial,
  retomada = false,
  onPaciente,
  sons,
  onSair,
}: {
  sessaoInicial: SessaoRcp;
  /** Veio de uma sessão salva (página recarregada, celular travou). */
  retomada?: boolean;
  onPaciente: (p: Paciente) => void;
  sons: Sons;
  onSair: () => void;
}) {
  const [s, setS] = useState<SessaoRcp>(sessaoInicial);
  const [agora, setAgora] = useState(() => Date.now());
  const [mudo, setMudo] = useState(false);
  const [batida, setBatida] = useState<Batida | null>(null);
  // o desfibrilador não guarda carga entre recarregamentos: recomeça vazio
  const [carga, setCarga] = useState<"vazia" | "carregando" | "pronta">("vazia");
  const [confirmarSaida, setConfirmarSaida] = useState(false);
  const [painel, setPainel] = useState<Painel>(null);
  const [cvSinc, setCvSinc] = useState(false);
  const [cvCarga, setCvCarga] = useState<"vazia" | "carregando" | "pronta">("vazia");
  const metro = useRef<Metronomo | null>(null);
  const avisouAdrenalina = useRef(false);

  const atualizar = useCallback((f: (x: SessaoRcp) => SessaoRcp) => setS((x) => f(x)), []);
  const registrar = useCallback(
    (texto: string) => setS((x) => comEvento(x, Date.now(), texto)),
    [],
  );

  // tudo que muda vai para o aparelho na hora: recarregar não perde a RCP
  useEffect(() => {
    salvarSessao(s);
  }, [s]);

  // retomada: anota no registro, uma vez
  const anotouRetomada = useRef(false);
  useEffect(() => {
    if (retomada && !anotouRetomada.current) {
      anotouRetomada.current = true;
      registrar("RCP retomada após a tela recarregar");
    }
  }, [retomada, registrar]);

  const {
    inicio,
    cicloInicio,
    fase,
    relacao,
    eventos,
    choques,
    adrenalinas,
    ultimaAdrenalina,
    amiodaronas,
    ritmo,
    cvPasso,
  } = s;
  const paciente = s.paciente;
  const peso = paciente?.peso ?? null;
  const causas = new Set(s.causas);
  const registros = s.registros;
  const encerrada = fase === "fim";

  useWakeLock(!encerrada);

  const decorrido = encerrada ? duracao(s, agora) : agora - inicio;
  const noCiclo = agora - cicloInicio;
  const restaCiclo = CICLO_MS - noCiclo;
  const desdeAdrenalina = ultimaAdrenalina === null ? null : agora - ultimaAdrenalina;
  const adr = estadoAdrenalina(desdeAdrenalina);
  const adrBolus = peso ? calcularBolus(droga("adrenalina-iv"), peso) : null;
  const amioBolus = peso ? calcularBolus(droga("amiodarona"), peso) : null;
  const proximoChoque = peso ? energiaDesfibrilacaoN(choques + 1, peso) : null;
  const cvEnergia = peso ? energiaChoque(CARGAS_CARDIOVERSAO.at(cvPasso) ?? 0.5, peso) : null;
  const va = paciente?.idade ? viaAerea(paciente.idade) : null;
  const compressor = compressorDaVez(s);
  const mostrarTroca = s.ciclo > 0 && fase === "rcp" && noCiclo < AVISO_TROCA_MS;

  const setFase = (f: SessaoRcp["fase"]) => atualizar((x) => ({ ...x, fase: f }));
  const setRitmo = (r: Ritmo) => atualizar((x) => ({ ...x, ritmo: r }));
  const setCvPasso = (v: number | ((p: number) => number)) =>
    atualizar((x) => ({ ...x, cvPasso: typeof v === "function" ? v(x.cvPasso) : v }));
  const setCausas = (c: Set<string>) => atualizar((x) => ({ ...x, causas: [...c] }));
  const setEquipe = (id: keyof Equipe, v: string) =>
    atualizar((x) => ({ ...x, equipe: { ...x.equipe, [id]: v } }));

  const registrarDroga = (id: string) => (texto: string) => {
    atualizar((x) =>
      comEvento(
        { ...x, registros: { ...x.registros, [id]: (x.registros[id] ?? 0) + 1 } },
        Date.now(),
        texto,
      ),
    );
    toast.success("Registrado", { description: texto });
  };

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
      atualizar((x) => comEvento({ ...x, fase: "checagem" }, Date.now(), "Checagem de ritmo"));
      sons.alarme();
      navigator.vibrate?.([200, 100, 200, 100, 200]);
    }
  }, [fase, restaCiclo, sons, atualizar]);

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

  /** Novo ciclo de 2 min: troca quem comprime (PALS), com som e aviso. */
  const novoCiclo = () => {
    const agoraMs = Date.now();
    atualizar((x) => {
      const prox = { ...x, fase: "rcp" as const, cicloInicio: agoraMs, ciclo: x.ciclo + 1 };
      const nome = compressorDaVez(prox);
      return comEvento(prox, agoraMs, `Troca de compressor${nome ? ` — agora ${nome}` : ""}`);
    });
    sons.troca();
  };

  const encerrar = (resultado: "rce" | "encerrada") => {
    const agoraMs = Date.now();
    atualizar((x) =>
      comEvento(
        { ...x, fase: "fim", fim: { em: agoraMs, resultado } },
        agoraMs,
        resultado === "rce" ? "Retorno da circulação espontânea (RCE)" : "RCP encerrada sem RCE",
      ),
    );
    setConfirmarSaida(false);
  };

  const escolherRitmo = (r: Ritmo | "rce") => {
    if (r === "rce") {
      encerrar("rce");
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

  const abrirChoque = () => {
    setRitmo("chocavel");
    setCarga("vazia");
    setFase("choque");
    registrar("Desfibrilação indicada");
  };

  const carregar = async () => {
    setCarga("carregando");
    registrar(
      proximoChoque ? `Carregando ${proximoChoque.joules} J` : "Carregando (peso não informado)",
    );
    await sons.carregar(2500);
    setCarga("pronta");
    sons.prontoParaChocar();
  };

  const chocar = () => {
    sons.choque();
    navigator.vibrate?.(300);
    atualizar((x) =>
      comEvento(
        { ...x, choques: x.choques + 1 },
        Date.now(),
        proximoChoque
          ? `Choque ${x.choques + 1}: ${proximoChoque.joules} J (${formatarNumero(proximoChoque.jPorKg, 0)} J/kg)`
          : `Choque ${x.choques + 1}`,
      ),
    );
    setCarga("vazia");
    novoCiclo();
  };

  const carregarCv = async () => {
    setCvCarga("carregando");
    await sons.carregar(2000);
    setCvCarga("pronta");
    sons.prontoParaChocar();
  };
  const chocarCv = () => {
    sons.choque();
    registrar(
      cvEnergia
        ? `Cardioversão sincronizada: ${cvEnergia.joules} J (${formatarNumero(cvEnergia.jPorKg, 1)} J/kg)`
        : "Cardioversão sincronizada",
    );
    setCvCarga("vazia");
    setCvSinc(false);
    setCvPasso((p) => Math.min(CARGAS_CARDIOVERSAO.length - 1, p + 1));
  };

  const darAdrenalina = () => {
    const agoraMs = Date.now();
    avisouAdrenalina.current = false;
    atualizar((x) =>
      comEvento(
        { ...x, adrenalinas: x.adrenalinas + 1, ultimaAdrenalina: agoraMs },
        agoraMs,
        adrBolus
          ? `Adrenalina ${x.adrenalinas + 1}: ${formatarNumero(adrBolus.dose, 3)} mg (${formatarMl(adrBolus.volumeMl)} mL de 0,1 mg/mL)`
          : `Adrenalina ${x.adrenalinas + 1}`,
      ),
    );
  };

  const darAmiodarona = () => {
    atualizar((x) =>
      comEvento(
        { ...x, amiodaronas: x.amiodaronas + 1 },
        Date.now(),
        amioBolus
          ? `Amiodarona ${x.amiodaronas + 1}: ${formatarNumero(amioBolus.dose, 1)} mg (${formatarMl(amioBolus.volumeMl)} mL)`
          : `Amiodarona ${x.amiodaronas + 1}`,
      ),
    );
  };

  const trocarRelacao = (r: Relacao) => {
    atualizar((x) =>
      comEvento(
        { ...x, relacao: r },
        Date.now(),
        r === "continua" ? "Via aérea avançada: compressões contínuas" : `Relação ${r}`,
      ),
    );
  };

  const copiarRegistro = async () => {
    try {
      await navigator.clipboard.writeText(textoRegistro(s, Date.now()));
      toast.success("Registro copiado");
    } catch {
      toast.error("Não consegui copiar o registro.");
    }
  };

  const baixarPdf = () => {
    try {
      baixarRelatorioPdf(s, Date.now());
    } catch {
      toast.error("Não consegui gerar o PDF. Copie o registro em texto.");
    }
  };

  const sair = () => {
    metro.current?.parar();
    if (encerrada) apagarSessao();
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
  const R = 92;
  const C = 2 * Math.PI * R;
  const ventilando = batida?.tipo === "ventilacao";
  const fechar = () => setPainel(null);
  const lista = (itens: ItemKit[]) => (
    <ul className="grid gap-3">
      {itens.map((it) => (
        <DoseRapida
          key={it.droga.id}
          item={it}
          peso={peso}
          vezes={registros[it.droga.id] ?? 0}
          onRegistrar={encerrada ? undefined : registrarDroga(it.droga.id)}
        />
      ))}
    </ul>
  );
  const semPeso = !peso && (
    <button
      type="button"
      onClick={() => setPainel("peso")}
      className="border-warning bg-warning/10 text-foreground t-body focus-visible:ring-ring flex items-center gap-3 rounded-2xl border-2 border-dashed p-4 text-left font-semibold focus-visible:ring-2 focus-visible:outline-none"
    >
      <Scale className="text-warning h-6 w-6 shrink-0" aria-hidden="true" />
      Informe o peso para ver as doses e as cargas.
    </button>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Modo RCP"
      data-testid="ped-modo-pcr"
      className="bg-background fixed inset-0 z-50 overflow-y-auto"
    >
      {/* barra superior */}
      <header className="bg-navy text-navy-foreground sticky top-0 z-10">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <span className="relative grid h-10 w-10 shrink-0 place-items-center">
            {!encerrada && (
              <span
                className="ped-anel bg-destructive/50 absolute inset-0 rounded-full"
                aria-hidden="true"
              />
            )}
            <HeartPulse
              className={`relative h-7 w-7 ${encerrada ? "text-success" : "text-destructive"}`}
              aria-hidden="true"
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="t-label opacity-80">
              {encerrada ? "Encerrada" : retomada ? "RCP retomada" : "RCP"}
            </p>
            <p
              className="text-3xl leading-none font-black tabular-nums"
              data-testid="ped-pcr-total"
            >
              {formatarTempo(decorrido)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPainel("peso")}
            data-testid="ped-pcr-peso"
            className={`touch-target focus-visible:ring-ring rounded-2xl px-3 text-left focus-visible:ring-2 focus-visible:outline-none ${
              peso ? "bg-white/10" : "bg-warning text-warning-foreground"
            }`}
          >
            <span className="block text-lg leading-tight font-black tabular-nums">
              {peso ? `${formatarNumero(peso, 1)} kg` : "Peso?"}
            </span>
            {paciente?.idade && (
              <span className="t-label block opacity-80">{descreverIdade(paciente.idade)}</span>
            )}
          </button>
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
          {confirmarSaida || encerrada ? (
            <button
              type="button"
              onClick={encerrada ? sair : () => encerrar("encerrada")}
              data-testid="ped-pcr-sair"
              className="touch-target bg-destructive text-destructive-foreground focus-visible:ring-ring rounded-2xl px-3 font-bold focus-visible:ring-2 focus-visible:outline-none"
            >
              {encerrada ? "Fechar" : "Encerrar"}
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
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-4 px-4 py-4 lg:grid-cols-[1fr_380px]">
        <div className="grid content-start gap-4">
          {/* compressões */}
          {(fase === "rcp" || fase === "choque") && (
            <section
              aria-label="Compressões"
              className="bg-card border-border grid justify-items-center gap-3 rounded-[2rem] border p-4"
            >
              <div className="relative h-60 w-60">
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
                    strokeWidth="9"
                  />
                  <circle
                    cx="100"
                    cy="100"
                    r={R}
                    fill="none"
                    stroke={restaCiclo < 15_000 ? "var(--warning)" : "var(--primary)"}
                    strokeWidth="9"
                    strokeLinecap="round"
                    strokeDasharray={C}
                    strokeDashoffset={C * (1 - progresso)}
                    style={{ transition: "stroke-dashoffset 0.25s linear" }}
                  />
                </svg>
                <div
                  key={batida ? `${batida.tipo}-${batida.n}` : "parado"}
                  className={`absolute inset-5 grid place-items-center rounded-full ${ventilando ? "bg-primary/15" : "bg-destructive/12"} ${
                    batida ? "ped-batida" : ""
                  }`}
                  style={{ ["--ped-ciclo" as string]: "0.45s", animationIterationCount: 1 }}
                >
                  <div className="text-center">
                    {ventilando ? (
                      <>
                        <Wind className="text-primary mx-auto h-12 w-12" aria-hidden="true" />
                        <p className="text-primary text-3xl font-black">Ventile</p>
                      </>
                    ) : (
                      <>
                        <p
                          className="text-destructive text-7xl leading-none font-black tabular-nums"
                          data-testid="ped-pcr-contagem"
                        >
                          {batida?.tipo === "compressao" ? (batida.total ? batida.n : "•") : "—"}
                        </p>
                        <p className="t-body text-muted-foreground mt-1 font-semibold">
                          {batida?.tipo === "compressao" && batida.total
                            ? `de ${batida.total}`
                            : "Comprima"}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {mostrarTroca ? (
                <p
                  role="status"
                  data-testid="ped-aviso-troca"
                  className="bg-warning text-warning-foreground ped-alerta flex items-center gap-2 rounded-2xl px-4 py-2 text-lg font-black"
                >
                  <RefreshCw className="h-5 w-5" aria-hidden="true" />
                  Troque quem comprime{compressor ? ` — agora ${compressor}` : ""}
                </p>
              ) : (
                compressor && (
                  <p className="t-body text-muted-foreground">
                    Comprimindo: <strong className="text-foreground">{compressor}</strong>
                  </p>
                )
              )}
              <p className="t-body text-foreground text-center tabular-nums">
                Checar ritmo em <strong className="text-xl">{formatarTempo(restaCiclo)}</strong>
              </p>
              <p className="t-label text-muted-foreground text-center font-medium">
                {COMPRESSOES_POR_MINUTO}/min · afundar 1/3 do tórax · retorno total · troque quem
                comprime a cada 2 min
              </p>
              <div
                className="bg-muted grid w-full max-w-md grid-cols-3 rounded-2xl p-1"
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
                    className={`touch-target t-label rounded-xl px-2 leading-tight focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none ${
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
              className="border-warning bg-warning/10 grid gap-3 rounded-[2rem] border-2 p-5"
            >
              <p className="t-title text-foreground">
                Pare as compressões. Ritmo e pulso em até 10 s.
              </p>
              <button
                type="button"
                data-testid="ped-ritmo-chocavel"
                onClick={() => escolherRitmo("chocavel")}
                className="bg-destructive text-destructive-foreground focus-visible:ring-ring grid h-20 rounded-2xl text-lg font-bold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <span>Chocável</span>
                <span className="text-sm font-semibold opacity-90">FV ou TV sem pulso</span>
              </button>
              <button
                type="button"
                data-testid="ped-ritmo-nao-chocavel"
                onClick={() => escolherRitmo("nao-chocavel")}
                className="bg-foreground text-background focus-visible:ring-ring grid h-20 rounded-2xl text-lg font-bold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <span>Não chocável</span>
                <span className="text-sm font-semibold opacity-80">AESP ou assistolia</span>
              </button>
              <button
                type="button"
                onClick={() => escolherRitmo("rce")}
                className="bg-success text-success-foreground focus-visible:ring-ring h-16 rounded-2xl text-lg font-bold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Pulso presente · RCE
              </button>
            </section>
          )}

          {/* desfibrilação */}
          {fase === "choque" && (
            <section
              aria-label="Desfibrilação"
              className="bg-card border-destructive grid gap-4 rounded-[2rem] border-2 p-4"
            >
              <div className="grid items-center gap-4 sm:grid-cols-[220px_1fr]">
                <Desfibrilador
                  joules={proximoChoque?.joules ?? null}
                  carga={carga === "vazia" ? 0 : carga === "carregando" ? 0.6 : 1}
                  className="w-full max-w-[240px] justify-self-center"
                />
                <div className="grid gap-1">
                  <p className="t-eyebrow text-destructive">Desfibrilação · não sincronizada</p>
                  <p className="text-foreground text-3xl font-black tabular-nums">
                    {choques + 1}º choque{proximoChoque ? `: ${proximoChoque.joules} J` : ""}
                  </p>
                  <p className="t-body text-muted-foreground">
                    {proximoChoque
                      ? `${formatarNumero(proximoChoque.jPorKg, 0)} J/kg${proximoChoque.atingiuTeto ? " · limitado a 200 J" : ""}.`
                      : "2 J/kg, depois 4 J/kg, até 10 J/kg."}{" "}
                    Continue comprimindo enquanto carrega.
                  </p>
                </div>
              </div>
              {semPeso}
              {carga !== "pronta" ? (
                <button
                  type="button"
                  data-testid="ped-carregar"
                  disabled={carga === "carregando"}
                  onClick={carregar}
                  className="bg-warning text-warning-foreground focus-visible:ring-ring h-16 rounded-2xl text-xl font-black focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-70"
                >
                  {carga === "carregando"
                    ? "Carregando…"
                    : `Carregar${proximoChoque ? ` ${proximoChoque.joules} J` : ""}`}
                </button>
              ) : (
                <button
                  type="button"
                  data-testid="ped-chocar"
                  onClick={chocar}
                  className="bg-destructive text-destructive-foreground focus-visible:ring-ring relative h-20 rounded-2xl text-xl font-black tracking-wide focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <span
                    className="ped-anel border-destructive pointer-events-none absolute inset-0 rounded-2xl border-4"
                    aria-hidden="true"
                  />
                  <Zap className="mr-2 inline h-7 w-7" aria-hidden="true" />
                  AFASTEM-SE · CHOCAR
                </button>
              )}
              <button
                type="button"
                onClick={novoCiclo}
                className="t-label text-muted-foreground hover:text-foreground focus-visible:ring-ring min-h-11 rounded-xl underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                Cancelar choque e voltar às compressões
              </button>
            </section>
          )}

          {/* fim: RCE ou encerrada */}
          {encerrada && (
            <section
              aria-label="Resumo"
              data-testid="ped-pcr-fim"
              className={`grid gap-3 rounded-[2rem] border-2 p-5 ${
                s.fim?.resultado === "rce"
                  ? "border-success bg-success/10"
                  : "border-border bg-card"
              }`}
            >
              <p className="t-title text-foreground">
                {desfecho(s)} · {formatarTempo(decorrido)}
              </p>
              <p className="t-body text-muted-foreground">
                {choques} choque(s) · {adrenalinas} adrenalina(s) · {amiodaronas} amiodarona(s) ·{" "}
                {eventos.length} eventos registrados
              </p>
              {s.fim?.resultado === "rce" && (
                <p className="t-body text-foreground">
                  Cuidados pós-PCR: oxigenação e ventilação, PA acima do mínimo para a idade,
                  glicemia, temperatura e ECG de 12 derivações. Taquiarritmia com pulso e instável:
                  cardioversão sincronizada.
                </p>
              )}
              <button
                type="button"
                onClick={baixarPdf}
                data-testid="ped-pcr-pdf"
                className="bg-foreground text-background focus-visible:ring-ring inline-flex h-14 items-center justify-center gap-2 rounded-2xl text-lg font-bold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <FileDown className="h-5 w-5" aria-hidden="true" /> Baixar registro em PDF
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPainel("equipe")}
                  className="touch-target bg-card border-border text-foreground focus-visible:ring-ring inline-flex items-center justify-center gap-2 rounded-2xl border font-semibold focus-visible:ring-2 focus-visible:outline-none"
                >
                  <Users className="h-5 w-5" aria-hidden="true" /> Equipe
                </button>
                <button
                  type="button"
                  onClick={copiarRegistro}
                  className="touch-target bg-card border-border text-foreground focus-visible:ring-ring inline-flex items-center justify-center gap-2 rounded-2xl border font-semibold focus-visible:ring-2 focus-visible:outline-none"
                >
                  <Copy className="h-5 w-5" aria-hidden="true" /> Copiar texto
                </button>
              </div>
              {s.fim?.resultado === "rce" && (
                <button
                  type="button"
                  onClick={() => setPainel("cardioversao")}
                  className="touch-target bg-card border-border text-foreground focus-visible:ring-ring inline-flex items-center justify-center gap-2 rounded-2xl border font-semibold focus-visible:ring-2 focus-visible:outline-none"
                >
                  <Activity className="h-5 w-5" aria-hidden="true" /> Cardioversão sincronizada
                </button>
              )}
            </section>
          )}

          {sugeridas.length > 0 && !encerrada && (
            <section
              aria-label="Próximos passos"
              className="bg-card border-border rounded-[2rem] border p-4"
            >
              <p className="t-eyebrow text-muted-foreground mb-2">Próximos passos</p>
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

        {/* ações e registro */}
        <aside className="grid content-start gap-4">
          {semPeso}
          <section aria-label="Ações" className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Acao
                largo
                testid="ped-dar-adrenalina"
                tom={adr === "atrasada" ? "atencao" : adr === "pode" ? "primario" : "neutro"}
                icone={<Syringe className="h-6 w-6" aria-hidden="true" />}
                titulo={`Adrenalina${adrBolus ? ` · ${formatarMl(adrBolus.volumeMl)} mL` : ""}`}
                linha={
                  desdeAdrenalina === null
                    ? `${adrBolus ? `${formatarNumero(adrBolus.dose, 3)} mg · 1 + 9 mL AD · ` : ""}toque ao administrar`
                    : adr === "aguardando"
                      ? `Próxima em ${formatarTempo(ADRENALINA_MIN_MS - desdeAdrenalina)} · ${adrenalinas} dose(s)`
                      : adr === "pode"
                        ? `Liberada · limite em ${formatarTempo(ADRENALINA_MAX_MS - desdeAdrenalina)}`
                        : `Atrasada há ${formatarTempo(desdeAdrenalina - ADRENALINA_MAX_MS)}`
                }
                onClick={darAdrenalina}
                disabled={encerrada}
              />
            </div>
            <Acao
              testid="ped-acao-choque"
              tom="perigo"
              icone={<Zap className="h-6 w-6" aria-hidden="true" />}
              titulo="Desfibrilar"
              linha={proximoChoque ? `${proximoChoque.joules} J agora` : "FV/TV sem pulso"}
              onClick={abrirChoque}
              disabled={encerrada || fase === "choque"}
            />
            <Acao
              testid="ped-acao-cardioversao"
              icone={<Activity className="h-6 w-6" aria-hidden="true" />}
              titulo="Cardioversão"
              linha="Sincronizada · com pulso"
              onClick={() => setPainel("cardioversao")}
            />
            <Acao
              testid="ped-dar-amiodarona"
              tom={ritmo === "chocavel" && choques >= 3 && amiodaronas < 3 ? "primario" : "neutro"}
              icone={<Syringe className="h-6 w-6" aria-hidden="true" />}
              titulo={`Amiodarona${amioBolus ? ` · ${formatarMl(amioBolus.volumeMl)} mL` : ""}`}
              linha={`Após 3º choque · ${amiodaronas}/3`}
              onClick={darAmiodarona}
              disabled={encerrada || amiodaronas >= 3}
            />
            <Acao
              testid="ped-acao-intubacao"
              tom={relacao === "continua" ? "primario" : "neutro"}
              icone={<Wind className="h-6 w-6" aria-hidden="true" />}
              titulo="Intubação"
              linha={
                va ? `Tubo ${formatarNumero(va.tuboComCuff, 1)} c/ cuff` : "Via aérea avançada"
              }
              onClick={() => setPainel("intubacao")}
            />
            <Acao
              testid="ped-acao-sedoanalgesia"
              icone={<Moon className="h-6 w-6" aria-hidden="true" />}
              titulo="Sedoanalgesia"
              linha="Fentanil, cetamina…"
              onClick={() => setPainel("sedoanalgesia")}
            />
            <Acao
              testid="ped-acao-outras"
              icone={<FlaskConical className="h-6 w-6" aria-hidden="true" />}
              titulo="Outras drogas"
              linha="Lidocaína, Mg, Ca, glicose…"
              onClick={() => setPainel("outras")}
            />
            <div className="col-span-2">
              <Acao
                largo
                icone={<ListChecks className="h-6 w-6" aria-hidden="true" />}
                titulo="Causas reversíveis — Hs e Ts"
                linha={
                  causas.size
                    ? `${causas.size} verificada(s)`
                    : "Hipóxia, hipovolemia, pneumotórax…"
                }
                onClick={() => setPainel("causas")}
              />
            </div>
            <div className="col-span-2">
              <Acao
                largo
                testid="ped-acao-equipe"
                icone={<Users className="h-6 w-6" aria-hidden="true" />}
                titulo="Equipe"
                linha={
                  PAPEIS.filter((r) => s.equipe[r.id].trim()).length
                    ? PAPEIS.filter((r) => s.equipe[r.id].trim())
                        .map((r) => s.equipe[r.id].trim())
                        .join(" · ")
                    : "Líder, compressores, via aérea, medicação"
                }
                onClick={() => setPainel("equipe")}
              />
            </div>
          </section>

          <section
            aria-label="Registro"
            className="bg-card border-border rounded-[2rem] border p-4"
          >
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
            <ol className="mt-2 grid gap-1.5" data-testid="ped-pcr-registro">
              {[...eventos].reverse().map((e, i) => (
                <li
                  key={`${e.t}-${i}`}
                  className="t-body text-foreground grid grid-cols-[3.5rem_1fr] gap-2 tabular-nums"
                >
                  <span className="text-muted-foreground">{formatarTempo(e.t)}</span>
                  <span>{e.texto}</span>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </main>

      {/* gavetas */}
      <Gaveta
        titulo="Peso e idade"
        subtitulo="As doses e as cargas aparecem assim que o peso entra."
        aberta={painel === "peso"}
        onFechar={fechar}
      >
        <Identificacao
          inicial={paciente}
          rotuloBotao="Usar este peso"
          onConfirmar={(p) => {
            onPaciente(p);
            atualizar((x) => ({ ...x, paciente: p }));
            registrar(`Peso ${formatarNumero(p.peso, 1)} kg${p.pesoEstimado ? " (estimado)" : ""}`);
            fechar();
          }}
        />
      </Gaveta>

      <Gaveta
        titulo="Cardioversão sincronizada"
        subtitulo="Taquiarritmia COM pulso e instável (TSV ou TV com pulso). Sem pulso, use desfibrilação."
        aberta={painel === "cardioversao"}
        onFechar={fechar}
      >
        {semPeso}
        <div className="bg-card border-border grid gap-4 rounded-3xl border p-4">
          <Desfibrilador
            joules={cvEnergia?.joules ?? null}
            carga={cvCarga === "vazia" ? 0 : cvCarga === "carregando" ? 0.6 : 1}
            sincronizado
            className="mx-auto w-full max-w-[260px]"
          />
          <ol className="grid grid-cols-3 gap-2" aria-label="Cargas da cardioversão">
            {CARGAS_CARDIOVERSAO.map((j, i) => (
              <li key={j}>
                <button
                  type="button"
                  onClick={() => setCvPasso(i)}
                  aria-current={cvPasso === i ? "step" : undefined}
                  className={`focus-visible:ring-ring grid w-full rounded-2xl border-2 px-2 py-2 text-center focus-visible:ring-2 focus-visible:outline-none ${
                    cvPasso === i ? "border-warning bg-warning/15" : "border-border bg-card"
                  }`}
                >
                  <span className="t-label text-muted-foreground">
                    {i + 1}ª · {formatarNumero(j, 1)} J/kg
                  </span>
                  <span className="text-foreground text-xl font-black tabular-nums">
                    {peso ? `${energiaChoque(j, peso).joules} J` : "—"}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <label className="border-warning bg-warning/10 t-body text-foreground flex min-h-14 items-center gap-3 rounded-2xl border-2 px-4 font-semibold">
            <input
              type="checkbox"
              checked={cvSinc}
              onChange={(e) => setCvSinc(e.target.checked)}
              data-testid="ped-cv-sinc"
              className="accent-primary h-6 w-6 shrink-0"
            />
            Modo SINC ligado e marcas sobre o QRS
          </label>
          {cvCarga !== "pronta" ? (
            <button
              type="button"
              disabled={!cvSinc || cvCarga === "carregando"}
              onClick={carregarCv}
              className="bg-warning text-warning-foreground focus-visible:ring-ring h-14 rounded-2xl text-lg font-black focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-40"
            >
              {cvCarga === "carregando"
                ? "Carregando…"
                : `Carregar${cvEnergia ? ` ${cvEnergia.joules} J` : ""} (SINC)`}
            </button>
          ) : (
            <button
              type="button"
              onClick={chocarCv}
              data-testid="ped-cv-chocar"
              className="bg-destructive text-destructive-foreground focus-visible:ring-ring h-16 rounded-2xl text-lg font-black tracking-wide focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <Zap className="mr-2 inline h-6 w-6" aria-hidden="true" />
              AFASTEM-SE · CHOQUE SINCRONIZADO
            </button>
          )}
          <p className="t-label text-muted-foreground font-medium">
            Mantenha o botão pressionado até o disparo: o aparelho espera o próximo QRS. Reavalie o
            ritmo após cada choque.
          </p>
        </div>
        <p className="t-eyebrow text-muted-foreground">Antes do choque, se consciente</p>
        {lista(KIT_CARDIOVERSAO)}
      </Gaveta>

      <Gaveta
        titulo="Intubação"
        subtitulo="Sequência rápida. Durante a RCP, minimize a pausa nas compressões."
        aberta={painel === "intubacao"}
        onFechar={fechar}
      >
        {semPeso}
        {va ? (
          <div className="bg-card border-border grid grid-cols-2 gap-3 rounded-3xl border p-4">
            <div className="grid justify-items-center gap-1 text-center">
              <Tubo diametro={va.tuboComCuff} className="h-20 w-32" />
              <p className="text-foreground text-3xl font-black tabular-nums">
                {formatarNumero(va.tuboComCuff, 1)}
              </p>
              <p className="t-label text-muted-foreground">
                mm com cuff · sem cuff {formatarNumero(va.tuboSemCuff, 1)}
              </p>
            </div>
            <div className="grid justify-items-center gap-1 text-center">
              <Laringoscopio curva={va.lamina.tipo !== "Reta"} className="h-20 w-28" />
              <p className="text-foreground text-3xl font-black tabular-nums">{va.lamina.numero}</p>
              <p className="t-label text-muted-foreground">Lâmina {va.lamina.tipo.toLowerCase()}</p>
            </div>
            <p className="t-body text-foreground col-span-2 text-center">
              Fixar em{" "}
              <strong className="tabular-nums">{formatarNumero(va.profundidadeCm, 1)} cm</strong> no
              lábio · tenha 0,5 mm acima e abaixo
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPainel("peso")}
            className="border-border bg-card t-body text-muted-foreground rounded-2xl border border-dashed p-4 text-left"
          >
            Informe a idade para ver o tubo e a lâmina.
          </button>
        )}
        <button
          type="button"
          data-testid="ped-intubado"
          disabled={relacao === "continua"}
          onClick={() => {
            trocarRelacao("continua");
            registrar(
              `Intubação${va ? ` com tubo ${formatarNumero(va.tuboComCuff, 1)} com cuff` : ""} — confirmar com capnografia`,
            );
            fechar();
          }}
          className="bg-primary text-primary-foreground focus-visible:ring-ring h-16 rounded-2xl text-lg font-bold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
        >
          {relacao === "continua"
            ? "Via aérea avançada em uso"
            : "Tubo posicionado · passar para compressões contínuas"}
        </button>
        <p className="t-eyebrow text-muted-foreground">Drogas da sequência rápida</p>
        {lista(KIT_INTUBACAO)}
      </Gaveta>

      <Gaveta
        titulo="Sedoanalgesia"
        subtitulo="Doses em bolus pelo peso."
        aberta={painel === "sedoanalgesia"}
        onFechar={fechar}
      >
        {semPeso}
        {lista(KIT_SEDOANALGESIA)}
      </Gaveta>

      <Gaveta
        titulo="Equipe"
        subtitulo="Os nomes entram no registro e no PDF. Os dois compressores se alternam a cada 2 min."
        aberta={painel === "equipe"}
        onFechar={fechar}
      >
        <div className="bg-card border-border grid gap-3 rounded-3xl border p-4">
          {PAPEIS.map((r) => (
            <label key={r.id} className="grid gap-1">
              <span className="t-label text-muted-foreground">{r.rotulo}</span>
              <input
                value={s.equipe[r.id]}
                data-testid={`ped-equipe-${r.id}`}
                onChange={(e) => setEquipe(r.id, e.target.value)}
                autoComplete="off"
                className="border-input bg-input-bg text-foreground focus-visible:ring-ring t-body h-12 rounded-2xl border px-4 focus-visible:ring-2 focus-visible:outline-none"
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={fechar}
          className="bg-foreground text-background focus-visible:ring-ring h-14 rounded-2xl text-lg font-bold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Pronto
        </button>
      </Gaveta>

      <Gaveta titulo="Outras drogas" aberta={painel === "outras"} onFechar={fechar}>
        {semPeso}
        {lista(KIT_OUTRAS)}
      </Gaveta>

      <Gaveta
        titulo="Causas reversíveis"
        subtitulo="Marque o que já foi avaliado."
        aberta={painel === "causas"}
        onFechar={fechar}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {(["H", "T"] as const).map((k) => (
            <ul key={k} className="bg-card border-border grid gap-1 rounded-3xl border p-3">
              <li className="t-eyebrow text-muted-foreground px-2 pb-1">
                {k === "H" ? "Hs" : "Ts"}
              </li>
              {CAUSAS_REVERSIVEIS[k].map((c) => (
                <li key={c}>
                  <label className="t-body text-foreground hover:bg-accent flex min-h-12 items-center gap-3 rounded-2xl px-2">
                    <input
                      type="checkbox"
                      checked={causas.has(c)}
                      onChange={(e) => {
                        const novo = new Set(causas);
                        if (e.target.checked) {
                          novo.add(c);
                          registrar(`Causa avaliada: ${c}`);
                        } else novo.delete(c);
                        setCausas(novo);
                      }}
                      className="accent-primary h-5 w-5 shrink-0"
                    />
                    {c}
                  </label>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </Gaveta>
    </div>
  );
}
