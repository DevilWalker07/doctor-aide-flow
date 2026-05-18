import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ChevronLeft, FileText, Copy, X, Loader2, ArrowRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { getEvolutionsByPatient, getPatientById } from "@/lib/db";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";

export const Route = createFileRoute("/evolucao/$id/historico")({
  component: HistoricoEvolucoesPage,
  head: () => ({ meta: [{ title: "Histórico de Evoluções — DOUTOR AJUDA" }] }),
});

function HistoricoEvolucoesPage() {
  const { id } = useParams({ from: "/evolucao/$id/historico" });
  const nav = useNavigate();
  const { userId } = useSupabaseUser();
  const [paciente, setPaciente] = useState<any>(null);
  const [evolucoes, setEvolucoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalEvolucao, setModalEvolucao] = useState<any>(null);

  useEffect(() => {
    if (!userId) return;
    async function load() {
      try {
        if (!id.startsWith("temp_")) {
          const p = await getPatientById(id, userId!);
          setPaciente(p);
          
          const evols = await getEvolutionsByPatient(id, userId!);
          setEvolucoes(evols);
        } else {
          throw new Error("Local fallback");
        }
      } catch (err) {
        const pExisting = JSON.parse(localStorage.getItem("da_pacientes") || "[]").find((x: any) => x.id === id);
        if (pExisting) {
          setPaciente({ name: pExisting.nome || pExisting.name, bed: pExisting.leito || pExisting.bed });
        }
        
        const existingEvol = JSON.parse(localStorage.getItem("da_evolucoes") || "[]")
          .filter((e: any) => e.patient_id === id)
          .map((e: any) => ({ ...e, id: e.id || `${e.patient_id}_${e.created_at}` }));
        setEvolucoes(existingEvol.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, userId]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="bg-elevated border-b border-border sticky top-0 z-30 shadow-sm">
        <div className="absolute top-0 left-0 w-1 bg-primary h-full" />
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/paciente/$id" params={{ id }} className="h-10 w-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary transition-all">
               <ChevronLeft className="h-5 w-5" />
            </Link>
            <div>
               <h1 className="text-xl font-black text-foreground tracking-tight uppercase">HISTÓRICO DE EVOLUÇÕES</h1>
               <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{paciente?.name || "Paciente"}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="space-y-4">
          {evolucoes.length === 0 ? (
            <div className="text-center py-20 bg-elevated border border-border rounded-[2rem] shadow-sm">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Nenhuma evolução encontrada</p>
            </div>
          ) : (
            evolucoes.map((ev, idx) => (
              <div key={ev.id || idx} className="bg-elevated border border-border rounded-3xl p-6 shadow-sm hover:border-primary/50 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-black text-primary uppercase tracking-widest bg-primary/10 px-3 py-1 rounded-lg">
                    {format(parseISO(ev.created_at), "dd/MM/yyyy 'às' HH:mm")}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground italic mb-6 line-clamp-2">
                  {ev.content}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setModalEvolucao(ev)}
                    className="flex-1 py-3 rounded-xl border border-border text-[10px] font-black uppercase tracking-widest hover:bg-secondary transition-all"
                  >
                    VER COMPLETA
                  </button>
                  <button
                    onClick={() => nav({ to: "/evolucao/$id", params: { id }, search: { from: ev.id } })}
                    className="py-3 px-4 rounded-xl bg-navy text-white text-[10px] font-black uppercase tracking-widest hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowRight className="h-4 w-4" /> USAR COMO BASE
                  </button>
                  <button
                    onClick={() => handleCopy(ev.content)}
                    className="py-3 px-4 rounded-xl bg-secondary text-foreground text-[10px] font-black uppercase tracking-widest hover:bg-border transition-all flex items-center justify-center gap-2"
                    aria-label="Copiar texto"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Modal Ver Completa */}
      {modalEvolucao && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-elevated w-full max-w-2xl rounded-[2.5rem] border border-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <header className="px-8 py-6 border-b border-border bg-secondary/30 flex items-center justify-between">
              <div>
                 <h2 className="text-sm font-black text-foreground uppercase tracking-widest mb-1">EVOLUÇÃO MÉDICA</h2>
                 <p className="text-[10px] font-bold text-muted-foreground uppercase">{format(parseISO(modalEvolucao.created_at), "dd/MM/yyyy HH:mm")}</p>
              </div>
              <button onClick={() => setModalEvolucao(null)} className="h-10 w-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary transition-all">
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground uppercase">
                {modalEvolucao.content}
              </pre>
            </div>
            <footer className="px-8 py-6 border-t border-border bg-secondary/30">
              <button 
                onClick={() => { handleCopy(modalEvolucao.content); setModalEvolucao(null); }}
                className="w-full py-4 rounded-xl bg-navy text-white font-black uppercase tracking-widest text-[10px] shadow-xl shadow-navy/20 flex items-center justify-center gap-2 hover:-translate-y-0.5 transition-all"
              >
                <Copy className="h-4 w-4" /> COPIAR TEXTO
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
