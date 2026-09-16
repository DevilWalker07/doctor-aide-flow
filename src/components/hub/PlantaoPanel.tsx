import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  ExternalLink,
  History,
  MapPin,
  RefreshCw,
  Users,
} from "lucide-react";
import { ambienteLabel, getAmbiente } from "@/lib/ambientes";
import type { Shift } from "@/lib/db";

export interface PlantaoAtivoCtx {
  id: string;
  data?: string;
  data_formatada?: string;
  hospital?: string | null;
  setor?: string | null;
  sector?: string | null;
  tipo?: string | null;
}

interface Props {
  plantaoAtivo: PlantaoAtivoCtx | null;
  stats: { pacientes: number; pendencias: number };
  closedShifts: Shift[];
  /** Último ambiente visitado, para retomar quando não há plantão aberto. */
  ultimoAmbiente: { ambienteId: string; subId?: string } | null;
  carregando: boolean;
  onViewHandoff: (shiftId: string) => void;
  onReopen: (shift: Shift) => void;
  formatDate: (iso: string) => string;
}

function Esqueleto() {
  return (
    <div
      className="border-border bg-card rounded-3xl border p-6"
      aria-hidden="true"
      data-testid="hub-plantao-esqueleto"
    >
      <div className="bg-muted h-4 w-40 animate-pulse rounded-full" />
      <div className="bg-muted mt-4 h-7 w-56 animate-pulse rounded-full" />
      <div className="bg-muted mt-3 h-4 w-44 animate-pulse rounded-full" />
      <div className="bg-muted mt-6 h-12 w-full animate-pulse rounded-2xl" />
    </div>
  );
}

/**
 * Retomada de contexto. O plantão em andamento é o caminho mais usado do app,
 * então recebe o maior peso visual da tela. Sem plantão, mas com um ambiente
 * já visitado, oferece voltar para lá. Sem nenhum dos dois, não ocupa espaço.
 */
export function PlantaoPanel({
  plantaoAtivo,
  stats,
  closedShifts,
  ultimoAmbiente,
  carregando,
  onViewHandoff,
  onReopen,
  formatDate,
}: Props) {
  const nav = useNavigate();

  if (carregando) return <Esqueleto />;

  const ambienteAnterior = ultimoAmbiente ? getAmbiente(ultimoAmbiente.ambienteId) : undefined;

  // Primeiro acesso: nada aqui, para a tela não abrir com espaço morto.
  if (!plantaoAtivo && closedShifts.length === 0 && !ambienteAnterior) return null;

  return (
    <section aria-labelledby="hub-plantao" className="space-y-3">
      <h2 id="hub-plantao" className="t-eyebrow text-muted-foreground">
        Continuar de onde parou
      </h2>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
        {plantaoAtivo && (
          <div
            className="relative rounded-3xl border border-emerald-500/40 bg-emerald-500/5 p-5 sm:p-6"
            data-testid="hub-plantao-ativo"
          >
            <span className="absolute top-6 right-6 flex h-3 w-3" aria-hidden="true">
              <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
            </span>

            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <Clock className="h-4 w-4" aria-hidden="true" />
              <span className="t-eyebrow">Plantão em andamento</span>
            </div>

            <h3 className="t-display text-foreground mt-3">
              {plantaoAtivo.setor || plantaoAtivo.sector || "Clínica Médica"}
            </h3>
            <p className="t-body text-muted-foreground mt-1">
              {plantaoAtivo.data_formatada || plantaoAtivo.data}
              {plantaoAtivo.hospital ? ` · ${plantaoAtivo.hospital}` : ""}
            </p>

            <div className="t-label text-foreground mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
              <span className="inline-flex items-center gap-2">
                <Users className="text-muted-foreground h-4 w-4" aria-hidden="true" />
                {stats.pacientes} {stats.pacientes === 1 ? "paciente" : "pacientes"}
              </span>
              <span className="inline-flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                {stats.pendencias} {stats.pendencias === 1 ? "pendência" : "pendências"}
              </span>
            </div>

            <button
              onClick={() => nav({ to: "/dashboard" })}
              data-testid="hub-continuar-plantao"
              className="t-label focus-visible:ring-ring mt-5 inline-flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-base font-bold text-white transition-colors hover:bg-emerald-700 focus-visible:ring-2 focus-visible:outline-none"
            >
              Continuar plantão <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Sem plantão aberto: pelo menos leva de volta ao último ambiente. */}
        {!plantaoAtivo && ambienteAnterior && (
          <Link
            to="/ambiente/$ambienteId"
            params={{ ambienteId: ambienteAnterior.id }}
            data-testid="hub-continuar-ambiente"
            className={`border-border bg-card hover:bg-secondary focus-visible:ring-ring flex items-center gap-4 rounded-3xl border p-5 transition-colors focus-visible:ring-2 focus-visible:outline-none`}
          >
            <div
              className={`h-12 w-12 shrink-0 rounded-2xl ${ambienteAnterior.accent.bg} ${ambienteAnterior.accent.text} flex items-center justify-center`}
            >
              <MapPin className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="t-eyebrow text-muted-foreground">Continuar em</p>
              <p className="t-title text-foreground mt-1 truncate">
                {ambienteLabel(ultimoAmbiente!.ambienteId, ultimoAmbiente!.subId)}
              </p>
            </div>
            <ArrowRight className="text-muted-foreground h-5 w-5 shrink-0" aria-hidden="true" />
          </Link>
        )}

        {closedShifts.length > 0 && (
          <div className="border-border bg-card rounded-3xl border p-5">
            <div className="text-muted-foreground mb-3 flex items-center gap-2">
              <History className="h-4 w-4" aria-hidden="true" />
              <span className="t-eyebrow">Plantões anteriores</span>
            </div>
            <ul className="space-y-2">
              {closedShifts.map((s) => (
                <li
                  key={s.id}
                  className="border-border bg-background flex flex-col gap-3 rounded-2xl border p-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="t-label text-foreground truncate">{s.sector || "Setor"}</p>
                    <p className="t-label text-muted-foreground font-normal">
                      {formatDate(s.date)} · {s.hospital}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onViewHandoff(s.id)}
                      className="t-label border-border text-foreground hover:bg-secondary focus-visible:ring-ring touch-target inline-flex items-center gap-1.5 rounded-xl border px-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" /> Passagem
                    </button>
                    <button
                      onClick={() => onReopen(s)}
                      className="t-label border-primary/50 text-primary hover:bg-primary/10 focus-visible:ring-ring touch-target inline-flex items-center gap-1.5 rounded-xl border px-3 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden="true" /> Reabrir
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
