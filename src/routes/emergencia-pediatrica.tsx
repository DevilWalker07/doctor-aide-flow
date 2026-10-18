import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, HeartPulse, Pencil, Search, UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { descreverIdade, formatarNumero } from "../../shared/pediatria/calculos";
import { BotaoRcp } from "@/components/pediatria/BotaoRcp";
import { BuscaGlobal } from "@/components/pediatria/BuscaGlobal";
import { ChoqueViaAerea } from "@/components/pediatria/ChoqueViaAerea";
import { FichaDrogas } from "@/components/pediatria/FichaDrogas";
import { Identificacao, type Paciente } from "@/components/pediatria/Identificacao";
import { Infusoes } from "@/components/pediatria/Infusoes";
import { Intubacao } from "@/components/pediatria/Intubacao";
import { NavInferior } from "@/components/pediatria/NavInferior";
import { ModoPcr } from "@/components/pediatria/ModoPcr";
import {
  carregarAba,
  carregarPaciente,
  salvarAba,
  salvarPaciente,
  type AbaPed,
} from "@/lib/pediatria/pacienteSalvo";
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

/**
 * Ficha de parada pediátrica, infusões e modo RCP. Tudo calculado no
 * navegador a partir do peso — nada é salvo, nada vai ao servidor. A RCP pode
 * começar antes do peso: o metrônomo não depende dele, as doses sim.
 */
function EmergenciaPediatricaPage() {
  // a criança atual volta sozinha se a página recarregar (12 h, só no aparelho)
  const [paciente, setPacienteEstado] = useState<Paciente | null>(() => carregarPaciente());
  const [editando, setEditando] = useState(() => carregarPaciente() === null);
  const [aba, setAbaEstado] = useState<AbaPed>(() => carregarAba());
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [infusaoInicial, setInfusaoInicial] = useState<string | undefined>(undefined);

  const setPaciente = (p: Paciente | null) => {
    setPacienteEstado(p);
    salvarPaciente(p);
  };
  const setAba = (a: AbaPed) => {
    setAbaEstado(a);
    salvarAba(a);
  };
  // trocar de seção volta ao topo: o conteúdo novo começa onde o olho está
  const mostrandoFicha = paciente && !editando;
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [aba, mostrandoFicha]);

  const novaCrianca = () => {
    const anterior = paciente;
    setPaciente(null);
    setEditando(true);
    toast("Pronto para uma nova criança", {
      action: anterior
        ? {
            label: "Desfazer",
            onClick: () => {
              setPaciente(anterior);
              setEditando(false);
            },
          }
        : undefined,
    });
  };
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

  // Atalho do ícone (?rcp=1): entra direto na RCP. Se já havia uma RCP em
  // andamento salva, retoma essa em vez de começar outra. O parâmetro sai da
  // URL para recarregar não abrir uma segunda RCP.
  const atalhoTratado = useRef(false);
  useEffect(() => {
    if (atalhoTratado.current) return;
    atalhoTratado.current = true;
    const url = new URL(window.location.href);
    if (url.searchParams.get("rcp") !== "1") return;
    url.searchParams.delete("rcp");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    if (salva && salva.fase !== "fim") retomarRcp(salva);
    else iniciarRcp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const descartarSalva = () => {
    apagarSessao();
    setSalva(null);
  };

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
          <h1 className={mostrandoFicha ? "sr-only" : "t-title text-foreground min-w-0 flex-1"}>
            Emergência pediátrica
          </h1>
          {mostrandoFicha && (
            <button
              type="button"
              onClick={() => setBuscaAberta(true)}
              data-testid="ped-abrir-busca"
              className="border-border bg-card text-muted-foreground focus-visible:ring-ring t-body flex h-12 min-w-0 flex-1 items-center gap-2 rounded-2xl border px-3 text-left focus-visible:ring-2 focus-visible:outline-none"
            >
              <Search className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="truncate">Buscar</span>
            </button>
          )}
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
          {mostrandoFicha && (
            <button
              type="button"
              onClick={novaCrianca}
              aria-label="Nova criança"
              data-testid="ped-nova-crianca"
              className="touch-target border-border bg-card text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center justify-center rounded-2xl border focus-visible:ring-2 focus-visible:outline-none"
            >
              <UserPlus className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
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
            {!paciente && <BotaoRcp onClick={iniciarRcp} />}
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
        ) : aba === "iot" ? (
          <Intubacao paciente={paciente} />
        ) : aba === "choque" ? (
          <ChoqueViaAerea paciente={paciente} />
        ) : (
          <Infusoes
            key={infusaoInicial ?? "padrao"}
            peso={paciente.peso}
            inicial={infusaoInicial}
          />
        )}

        <p className="t-label text-muted-foreground mt-10 text-center font-normal">
          Ferramenta de apoio. Confira a dose antes de administrar. Tabela: Calculadora UTI 2021
          (Flávio Valcácer e Tássio Campos); algoritmo, choque e sinais vitais: PALS 2020.
        </p>
      </main>

      {mostrandoFicha && (
        <BuscaGlobal
          aberta={buscaAberta}
          onFechar={() => setBuscaAberta(false)}
          peso={paciente.peso}
          onAba={setAba}
          onInfusao={(id) => {
            setInfusaoInicial(id);
            setAba("infusoes");
          }}
          onRcp={iniciarRcp}
        />
      )}

      {mostrandoFicha && !pcr && <NavInferior aba={aba} onAba={setAba} onRcp={iniciarRcp} />}

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
