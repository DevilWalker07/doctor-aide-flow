import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, ChevronLeft } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { getAmbiente, type Ambiente } from "@/lib/ambientes";

export const Route = createFileRoute("/ambiente/$ambienteId")({
  validateSearch: z.object({ sub: z.string().optional() }),
  loader: ({ params }) => {
    const ambiente = getAmbiente(params.ambienteId);
    if (!ambiente) throw notFound();
    return { ambiente };
  },
  component: AmbientePage,
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.ambiente.curto ?? "Ambiente"} — MEDFLUXO` }] }),
});

function AmbientePage() {
  const { ambiente } = Route.useLoaderData() as { ambiente: Ambiente };
  const { sub } = Route.useSearch();
  const nav = useNavigate();
  const [subId, setSubId] = useState<string>(() => (ambiente.subs.some((s) => s.id === sub) ? sub! : ambiente.subs[0].id));
  const subAtual = ambiente.subs.find((s) => s.id === subId) ?? ambiente.subs[0];

  const iniciar = () => nav({ to: "/iniciar-plantao", search: { ambiente: ambiente.id, sub: subAtual.id } });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className={`absolute -top-32 right-0 h-[420px] w-[420px] rounded-full ${ambiente.accent.bg} blur-[140px]`} />
      </div>

      <header className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-6 flex items-center gap-3">
        <Link to="/" aria-label="Voltar ao hub" className="h-11 w-11 rounded-2xl border border-slate-800 bg-slate-900/60 flex items-center justify-center text-slate-400 hover:text-slate-100 hover:border-slate-600 transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Ambiente de atendimento</span>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="flex items-start gap-4">
          <div className={`h-16 w-16 shrink-0 rounded-3xl ${ambiente.accent.bg} ${ambiente.accent.text} flex items-center justify-center`}>
            <ambiente.icon className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              <span aria-hidden="true" className="mr-2">{ambiente.emoji}</span>
              {ambiente.label}
            </h1>
            <p className="text-sm text-slate-400 mt-1">{ambiente.descricao}</p>
          </div>
        </div>

        <section aria-labelledby="sub-titulo" className="space-y-3">
          <h2 id="sub-titulo" className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
            Selecione a sub-área
          </h2>
          <div role="radiogroup" aria-label="Sub-área" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ambiente.subs.map((s) => {
              const ativo = s.id === subId;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  onClick={() => setSubId(s.id)}
                  data-testid={`ambiente-sub-${s.id}`}
                  className={`text-left rounded-2xl border p-4 transition-all focus-visible:outline-none focus-visible:ring-2 ${ambiente.accent.ring} ${
                    ativo ? `${ambiente.accent.border} ${ambiente.accent.bg} ring-1 ${ambiente.accent.ring}` : "border-slate-800 bg-slate-900/60 hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-black uppercase tracking-wide">
                      {s.icon ? <s.icon className={`h-4 w-4 ${ativo ? ambiente.accent.text : "text-slate-500"}`} /> : null}
                      {s.label}
                    </span>
                    {ativo && <Check className={`h-4 w-4 ${ambiente.accent.text}`} />}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{s.descricao}</p>
                </button>
              );
            })}
          </div>
        </section>

        <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/60 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Você vai abrir</p>
            <p className="text-lg font-black">
              {ambiente.curto} · <span className={ambiente.accent.text}>{subAtual.label}</span>
            </p>
            <p className="text-xs text-slate-400">Na próxima tela você informa a unidade e a data. O tipo de evolução e os agentes já ficam configurados.</p>
          </div>
          <button
            type="button"
            onClick={iniciar}
            data-testid="ambiente-iniciar"
            className="px-6 py-4 rounded-2xl bg-primary text-white font-black uppercase tracking-widest text-[11px] shadow-lg shadow-primary/30 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
          >
            Iniciar plantão aqui <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </main>
    </div>
  );
}
