import { createFileRoute, Link } from "@tanstack/react-router";
import { Baby, ChevronLeft, HeartPulse, Pencil } from "lucide-react";
import { useRef, useState } from "react";
import { descreverIdade, formatarNumero } from "../../shared/pediatria/calculos";
import { ChoqueViaAerea } from "@/components/pediatria/ChoqueViaAerea";
import { FichaDrogas } from "@/components/pediatria/FichaDrogas";
import { Identificacao, type Paciente } from "@/components/pediatria/Identificacao";
import { Infusoes } from "@/components/pediatria/Infusoes";
import { ModoPcr } from "@/components/pediatria/ModoPcr";
import { Sons } from "@/lib/pediatria/som";

export const Route = createFileRoute("/emergencia-pediatrica")({
  component: EmergenciaPediatricaPage,
  head: () => ({ meta: [{ title: "Emergência pediátrica — MEDFLUXO" }] }),
});

type Aba = "drogas" | "choque" | "infusoes";

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "drogas", rotulo: "Drogas" },
  { id: "choque", rotulo: "Choque e via aérea" },
  { id: "infusoes", rotulo: "Infusões" },
];

/**
 * Ficha de parada pediátrica, infusões e modo RCP. Tudo calculado no
 * navegador a partir do peso — nada é salvo, nada vai ao servidor.
 */
function EmergenciaPediatricaPage() {
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [editando, setEditando] = useState(true);
  const [aba, setAba] = useState<Aba>("drogas");
  const [pcr, setPcr] = useState(false);
  const sons = useRef<Sons | null>(null);

  const iniciarRcp = () => {
    // O áudio só pode nascer dentro do toque (iOS).
    if (!sons.current) sons.current = new Sons();
    sons.current.iniciar();
    setPcr(true);
  };

  const mostrandoFicha = paciente && !editando;

  return (
    <div className="bg-background min-h-screen pb-28">
      <header className="bg-background/95 sticky top-0 z-20 border-b border-transparent backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            to="/"
            aria-label="Voltar ao início"
            className="touch-target border-border bg-card text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center justify-center rounded-2xl border transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="t-title text-foreground flex items-center gap-2">
              <Baby className="text-destructive h-5 w-5 shrink-0" aria-hidden="true" />
              Emergência pediátrica
            </h1>
            {!mostrandoFicha && (
              <p className="t-label text-muted-foreground font-normal">
                Ficha de parada, infusões e RCP guiada
              </p>
            )}
          </div>
          {mostrandoFicha && (
            <button
              type="button"
              onClick={() => setEditando(true)}
              data-testid="ped-paciente-chip"
              className="touch-target border-border bg-card focus-visible:ring-ring flex items-center gap-2 rounded-2xl border px-3 text-left focus-visible:ring-2 focus-visible:outline-none"
            >
              <span>
                <span className="text-foreground block text-lg leading-none font-extrabold tabular-nums">
                  {formatarNumero(paciente.peso, 1)} kg
                  {paciente.pesoEstimado && (
                    <span className="text-warning ml-1 text-xs font-bold">est.</span>
                  )}
                </span>
                {paciente.idade && (
                  <span className="t-label text-muted-foreground font-normal">
                    {descreverIdade(paciente.idade)}
                  </span>
                )}
              </span>
              <Pencil className="text-muted-foreground h-4 w-4" aria-label="Alterar peso e idade" />
            </button>
          )}
        </div>
        {mostrandoFicha && (
          <nav className="mx-auto max-w-5xl px-4 pb-3 sm:px-6" aria-label="Seções">
            <div className="bg-muted flex rounded-2xl p-1">
              {ABAS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={aba === a.id}
                  data-testid={`ped-aba-${a.id}`}
                  onClick={() => setAba(a.id)}
                  className={`touch-target t-label flex-1 rounded-xl px-2 transition-colors focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none ${
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
        {!mostrandoFicha ? (
          <Identificacao
            inicial={paciente}
            onConfirmar={(p) => {
              setPaciente(p);
              setEditando(false);
            }}
          />
        ) : aba === "drogas" ? (
          <FichaDrogas peso={paciente.peso} />
        ) : aba === "choque" ? (
          <ChoqueViaAerea paciente={paciente} />
        ) : (
          <Infusoes peso={paciente.peso} />
        )}

        <p className="t-label text-muted-foreground mt-8 text-center font-normal">
          Ferramenta de apoio. Confira a dose antes de administrar. Tabela: Calculadora UTI 2021
          (Flávio Valcácer e Tássio Campos); sinais vitais e choque: PALS 2020.
        </p>
      </main>

      {mostrandoFicha && !pcr && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={iniciarRcp}
            data-testid="ped-iniciar-rcp"
            className="bg-destructive text-destructive-foreground focus-visible:ring-ring pointer-events-auto mx-auto flex h-16 w-full max-w-md items-center justify-center gap-3 rounded-3xl text-xl font-extrabold shadow-lg focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <HeartPulse className="h-7 w-7" aria-hidden="true" />
            Iniciar RCP
          </button>
        </div>
      )}

      {pcr && paciente && sons.current && (
        <ModoPcr peso={paciente.peso} sons={sons.current} onSair={() => setPcr(false)} />
      )}
    </div>
  );
}
