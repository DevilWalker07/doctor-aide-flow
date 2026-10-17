import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, HeartPulse, Pencil } from "lucide-react";
import { useRef, useState } from "react";
import { descreverIdade, formatarNumero } from "../../shared/pediatria/calculos";
import { BotaoRcp } from "@/components/pediatria/BotaoRcp";
import { ChoqueViaAerea } from "@/components/pediatria/ChoqueViaAerea";
import { FichaDrogas } from "@/components/pediatria/FichaDrogas";
import { Identificacao, type Paciente } from "@/components/pediatria/Identificacao";
import { Infusoes } from "@/components/pediatria/Infusoes";
import { ModoPcr } from "@/components/pediatria/ModoPcr";
import { desfecho } from "@/lib/pediatria/relatorioRcp";
import {
  apagarSessao,
  carregarSessao,
  novaSessao,
  type SessaoRcp,
} from "@/lib/pediatria/sessaoRcp";
import { Sons } from "@/lib/pediatria/som";
import { formatarTempo } from "../../shared/pediatria/pcr";

export const Route = createFileRoute("/emergencia-pediatrica")({
  component: EmergenciaPediatricaPage,
  head: () => ({ meta: [{ title: "Emergência pediátrica — MEDFLUXO" }] }),
});

type Aba = "drogas" | "choque" | "infusoes";

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "drogas", rotulo: "Drogas" },
  { id: "choque", rotulo: "Choque e intubação" },
  { id: "infusoes", rotulo: "Infusões" },
];

/**
 * Ficha de parada pediátrica, infusões e modo RCP. Tudo calculado no
 * navegador a partir do peso — nada é salvo, nada vai ao servidor. A RCP pode
 * começar antes do peso: o metrônomo não depende dele, as doses sim.
 */
function EmergenciaPediatricaPage() {
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [editando, setEditando] = useState(true);
  const [aba, setAba] = useState<Aba>("drogas");
  const [pcr, setPcr] = useState<{ sessao: SessaoRcp; retomada: boolean } | null>(null);
  // RCP que ficou salva no aparelho (página recarregada, celular travou)
  const [salva, setSalva] = useState<SessaoRcp | null>(() => carregarSessao(Date.now()));
  const sons = useRef<Sons | null>(null);

  const ligarSom = () => {
    // O áudio só pode nascer dentro do toque (iOS).
    if (!sons.current) sons.current = new Sons();
    sons.current.iniciar();
  };

  const iniciarRcp = () => {
    ligarSom();
    setSalva(null);
    setPcr({ sessao: novaSessao(Date.now(), paciente), retomada: false });
  };

  const retomarRcp = (s: SessaoRcp) => {
    ligarSom();
    if (s.paciente) {
      setPaciente(s.paciente);
      setEditando(false);
    }
    setSalva(null);
    setPcr({ sessao: s, retomada: s.fase !== "fim" });
  };

  const descartarSalva = () => {
    apagarSessao();
    setSalva(null);
  };

  const mostrandoFicha = paciente && !editando;

  return (
    <div className="bg-background min-h-screen pb-32">
      <header className="bg-background/90 sticky top-0 z-20 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            to="/"
            aria-label="Voltar ao início"
            className="touch-target border-border bg-card text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center justify-center rounded-2xl border transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <h1 className="t-title text-foreground min-w-0 flex-1">Emergência pediátrica</h1>
          {mostrandoFicha && (
            <button
              type="button"
              onClick={() => setEditando(true)}
              data-testid="ped-paciente-chip"
              aria-label="Alterar peso e idade"
              className="touch-target border-border bg-card focus-visible:ring-ring flex items-center gap-3 rounded-2xl border py-1.5 pr-3 pl-4 text-left focus-visible:ring-2 focus-visible:outline-none"
            >
              <span>
                <span className="text-foreground block text-xl leading-none font-black tabular-nums">
                  {formatarNumero(paciente.peso, 1)} kg
                  {paciente.pesoEstimado && (
                    <span className="text-warning ml-1 text-xs font-bold">est.</span>
                  )}
                </span>
                {paciente.idade && (
                  <span className="t-label text-muted-foreground font-medium">
                    {descreverIdade(paciente.idade)}
                  </span>
                )}
              </span>
              <Pencil className="text-muted-foreground h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
        {mostrandoFicha && (
          <nav className="mx-auto max-w-5xl px-4 pb-3 sm:px-6" aria-label="Seções">
            <div className="bg-muted grid grid-cols-3 rounded-2xl p-1">
              {ABAS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={aba === a.id}
                  data-testid={`ped-aba-${a.id}`}
                  onClick={() => setAba(a.id)}
                  className={`touch-target t-label rounded-xl px-2 leading-tight transition-colors focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none ${
                    aba === a.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {a.rotulo}
                </button>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
        {salva && !pcr && (
          <section
            role="alert"
            data-testid="ped-rcp-salva"
            className={`mx-auto mb-6 grid max-w-md gap-3 rounded-[2rem] border-2 p-4 ${
              salva.fase === "fim"
                ? "border-border bg-card"
                : "border-destructive bg-destructive/10"
            }`}
          >
            <div className="flex items-start gap-3">
              <HeartPulse
                className={`mt-0.5 h-6 w-6 shrink-0 ${salva.fase === "fim" ? "text-muted-foreground" : "text-destructive"}`}
                aria-hidden="true"
              />
              <div>
                <p className="t-title text-foreground">
                  {salva.fase === "fim" ? "Último registro de RCP" : "RCP em andamento"}
                </p>
                <p className="t-body text-muted-foreground">
                  Início às{" "}
                  {new Date(salva.inicio).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {salva.fase === "fim"
                    ? ` · ${desfecho(salva)}`
                    : ` · ${formatarTempo(Date.now() - salva.inicio)} decorridos · ${salva.eventos.length} eventos`}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <button
                type="button"
                onClick={() => retomarRcp(salva)}
                data-testid="ped-retomar-rcp"
                className={`focus-visible:ring-ring h-14 rounded-2xl text-lg font-bold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${
                  salva.fase === "fim"
                    ? "bg-foreground text-background"
                    : "bg-destructive text-destructive-foreground"
                }`}
              >
                {salva.fase === "fim" ? "Abrir registro" : "Retomar RCP"}
              </button>
              <button
                type="button"
                onClick={descartarSalva}
                className="touch-target border-border bg-card text-foreground focus-visible:ring-ring rounded-2xl border px-4 font-semibold focus-visible:ring-2 focus-visible:outline-none"
              >
                Descartar
              </button>
            </div>
          </section>
        )}
        {!mostrandoFicha ? (
          <div className="grid gap-8">
            {!paciente && <BotaoRcp variante="disco" onClick={iniciarRcp} />}
            {!paciente && (
              <div className="mx-auto flex w-full max-w-md items-center gap-3" aria-hidden="true">
                <span className="bg-border h-px flex-1" />
                <span className="t-label text-muted-foreground">ou calcule as doses pelo peso</span>
                <span className="bg-border h-px flex-1" />
              </div>
            )}
            <Identificacao
              inicial={paciente}
              onConfirmar={(p) => {
                setPaciente(p);
                setEditando(false);
              }}
            />
          </div>
        ) : aba === "drogas" ? (
          <FichaDrogas peso={paciente.peso} />
        ) : aba === "choque" ? (
          <ChoqueViaAerea paciente={paciente} />
        ) : (
          <Infusoes peso={paciente.peso} />
        )}

        <p className="t-label text-muted-foreground mt-10 text-center font-normal">
          Ferramenta de apoio. Confira a dose antes de administrar. Tabela: Calculadora UTI 2021
          (Flávio Valcácer e Tássio Campos); algoritmo, choque e sinais vitais: PALS 2020.
        </p>
      </main>

      {mostrandoFicha && !pcr && <BotaoRcp variante="barra" onClick={iniciarRcp} />}

      {pcr && sons.current && (
        <ModoPcr
          key={pcr.sessao.inicio}
          sessaoInicial={pcr.sessao}
          retomada={pcr.retomada}
          onPaciente={(p) => {
            setPaciente(p);
            setEditando(false);
          }}
          sons={sons.current}
          onSair={() => {
            setPcr(null);
            setSalva(carregarSessao(Date.now()));
          }}
        />
      )}
    </div>
  );
}
