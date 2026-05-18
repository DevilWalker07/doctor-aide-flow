import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { SPECIALISTS } from "@/lib/specialists/types";
import { SpecialistAvatar } from "@/components/specialists/SpecialistAvatar";
import ThemeToggle from "@/components/ThemeToggle";

export const Route = createFileRoute("/especialistas")({
  component: EspecialistasPage,
  head: () => ({ meta: [{ title: "Especialistas — Doutor Ajuda" }] }),
});

function EspecialistasPage() {
  const nav = useNavigate();
  const list = Object.values(SPECIALISTS);

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="bg-background/80 backdrop-blur-xl border-b border-border sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <button
            onClick={() => nav({ to: "/" })}
            className="inline-flex items-center gap-1.5 h-9 px-2 -ml-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-subtle transition-colors text-sm"
            aria-label="Voltar"
          >
            <ChevronLeft className="h-4 w-4" /> Início
          </button>
          <h1 className="text-[15px] font-semibold tracking-tight">Especialistas</h1>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          Tire dúvidas, discuta casos, peça opinião. Conversa livre — sem precisar cadastrar paciente.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {list.map((s) => (
            <button
              key={s.id}
              onClick={() => nav({ to: "/especialistas/$id", params: { id: s.id } })}
              className="flex items-center gap-3 p-4 rounded-xl bg-elevated border border-border hover:border-primary/40 hover:shadow-md transition-all text-left"
            >
              <div className={`h-12 w-12 rounded-full ${s.cor.bg} ${s.cor.text} flex items-center justify-center shrink-0`}>
                <SpecialistAvatar specialistId={s.id} size={40} className="rounded-full" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{s.nome}</p>
                <p className="text-[12px] text-muted-foreground truncate">{s.titulo} · {s.especialidade}</p>
                <p className="text-[11px] text-muted-foreground/80 italic mt-1 truncate">"{s.saudacao}"</p>
              </div>
              <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
