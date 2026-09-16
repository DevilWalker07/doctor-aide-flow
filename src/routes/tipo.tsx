import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useShift } from "@/hooks/useShift";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { acentoDo, tiposDeEvolucaoDisponiveis, type Local } from "@/lib/ambientes";
import { updateShift as dbUpdateShift } from "@/lib/db";

export const Route = createFileRoute("/tipo")({
  component: TipoPage,
  head: () => ({ meta: [{ title: "Onde você está hoje? — MEDFLUXO" }] }),
});

/**
 * As opções saem de `ambientes.ts`, a fonte única, deduplicadas por tipo de
 * evolução — é ele que define o template e os agentes. Esta tela mantinha a
 * própria lista de setores, que já divergia da fonte.
 */
const OPCOES: Local[] = tiposDeEvolucaoDisponiveis();

function TipoPage() {
  const nav = useNavigate();
  const { updateShift } = useShift();
  const { userId } = useSupabaseUser();

  const handleSelect = async (opcao: Local) => {
    localStorage.setItem("da_tipo_evolucao", opcao.tipoEvolucao);
    updateShift({ tipo: opcao.tipoEvolucao, setor: opcao.label });

    const shiftId = localStorage.getItem("da_shift_id");
    if (shiftId && !shiftId.startsWith("temp_") && userId) {
      try {
        await dbUpdateShift(shiftId, { type: opcao.tipoEvolucao, sector: opcao.label }, userId);
      } catch (err) {
        console.warn("Falha ao atualizar tipo no Supabase", err);
      }
    }

    toast.success(`Setor: ${opcao.label}`);
    nav({ to: "/dashboard" });
  };

  return (
    <div className="bg-background min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center gap-3 px-4 pt-5 sm:px-6">
        <Link
          to="/iniciar-plantao"
          aria-label="Voltar para o início do plantão"
          className="touch-target border-border bg-card text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center justify-center rounded-2xl border transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
        <span className="t-eyebrow text-muted-foreground">Seleção de setor</span>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="t-display text-foreground">Onde você está hoje?</h1>
        <p className="t-body text-muted-foreground mt-2">
          O setor define o modelo de evolução e os agentes que serão usados no plantão.
        </p>

        <ul className="mt-6 space-y-3">
          {OPCOES.map((o) => (
            <li key={o.id}>
              <button
                onClick={() => handleSelect(o)}
                data-testid={`tipo-${o.tipoEvolucao}`}
                className="border-border bg-card hover:bg-secondary focus-visible:ring-ring flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <div
                  className={`h-12 w-12 shrink-0 rounded-2xl ${acentoDo(o).bg} ${acentoDo(o).text} flex items-center justify-center`}
                >
                  <o.icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="t-title text-foreground">{o.label}</p>
                  <p className="t-body text-muted-foreground">{o.descricao}</p>
                </div>
                {/* A seta é sempre visível: o "Selecionar" que só aparecia no
                    hover nunca chegava a quem usa o app no celular. */}
                <ChevronRight
                  className="text-muted-foreground h-5 w-5 shrink-0"
                  aria-hidden="true"
                />
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
