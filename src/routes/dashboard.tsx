import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Stethoscope, Plus, Settings, Map, LayoutGrid, BedDouble, ArrowLeft, AlertCircle } from "lucide-react";
import { usePatients, type Patient } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { HandoffMap } from "@/components/HandoffMap";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Plantão — Clínica Médica" }] }),
});

function statusBadge(s: Patient["status"]) {
  switch (s) {
    case "PENDENTE": return <Badge variant="warning">PENDENTE</Badge>;
    case "EVOLUÇÃO GERADA": return <Badge variant="success">EVOLUÇÃO GERADA</Badge>;
    case "ALERTA RENAL": return <Badge variant="destructive">ALERTA RENAL</Badge>;
    case "ATB D4/7": return <Badge variant="ai">ATB D4/7</Badge>;
  }
}

function Dashboard() {
  const { patients } = usePatients();
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"gestao" | "mapa">("gestao");
  const nav = useNavigate();
  const sel = patients.find((p) => p.id === selected);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-[1500px] mx-auto px-6 h-16 flex items-center gap-6">
          <Link to="/tipo" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-navy text-navy-foreground grid place-items-center"><Stethoscope className="h-4 w-4" /></div>
            <div><div className="text-xs font-semibold tracking-tight">DOUTOR AJUDA</div><div className="label-tech text-[10px] -mt-0.5">CLÍNICA MÉDICA</div></div>
          </div>

          <nav className="ml-6 flex items-center gap-1">
            <button onClick={() => setTab("gestao")} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors ${tab === "gestao" ? "bg-navy text-navy-foreground" : "text-muted-foreground hover:bg-secondary"}`}><LayoutGrid className="inline h-3.5 w-3.5 mr-1.5" /> GESTÃO</button>
            <button onClick={() => setTab("mapa")} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors ${tab === "mapa" ? "bg-navy text-navy-foreground" : "text-muted-foreground hover:bg-secondary"}`}><Map className="inline h-3.5 w-3.5 mr-1.5" /> MAPA VIRTUAL</button>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => nav({ to: "/novo-paciente" })} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wide hover:bg-primary/90 transition-colors"><Plus className="h-4 w-4" /> NOVO PACIENTE</button>
            <Link to="/configuracoes" className="h-9 w-9 rounded-lg border border-border grid place-items-center text-muted-foreground hover:text-foreground hover:bg-secondary"><Settings className="h-4 w-4" /></Link>
          </div>
        </div>
      </header>

      {tab === "mapa" ? (
        <div className="max-w-[1500px] mx-auto px-6 py-6"><HandoffMap /></div>
      ) : (
        <div className="max-w-[1500px] mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          <aside className="space-y-3">
            <div className="flex items-center justify-between"><h2 className="label-tech">LEITOS · {patients.length}</h2><span className="label-tech text-primary">{patients.filter(p => p.status === "EVOLUÇÃO GERADA").length} EVOLUÍDOS</span></div>
            {patients.map((p) => (
              <button key={p.id} onClick={() => setSelected(p.id)} onDoubleClick={() => nav({ to: "/evolucao/$id", params: { id: p.id } })} className={`w-full text-left rounded-xl border bg-card p-4 transition-all ${selected === p.id ? "border-primary shadow-lg shadow-primary/10" : "border-border hover:border-primary/40"}`}>
                <div className="flex items-start gap-3"><Badge variant="navy" size="lg" className="font-mono">{p.bed}</Badge><div className="flex-1 min-w-0"><div className="font-bold text-sm text-foreground truncate">{p.name}</div><div className="text-xs text-muted-foreground mt-0.5">{p.age}A · {p.sex === "F" ? "FEM" : "MASC"}</div><div className="mt-2">{statusBadge(p.status)}</div></div></div>
              </button>
            ))}
          </aside>

          <main className="bg-card border border-border rounded-2xl min-h-[600px] p-8">
            {!sel ? (
              <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-center"><div className="h-20 w-20 rounded-2xl bg-secondary grid place-items-center mb-6"><BedDouble className="h-10 w-10 text-muted-foreground" /></div><h3 className="text-xl font-extrabold tracking-tight text-foreground">SELECIONE UM LEITO</h3><p className="mt-2 text-sm text-muted-foreground max-w-sm">Escolha um paciente na lista lateral para ver o resumo, ou cadastre um novo paciente.</p></div>
            ) : (
              <div>
                <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-3"><Badge variant="navy" size="xl" className="font-mono">{sel.bed}</Badge>{statusBadge(sel.status)}</div><h2 className="mt-4 text-2xl font-extrabold tracking-tight">{sel.name}</h2><p className="text-sm text-muted-foreground mt-1">{sel.age} ANOS · {sel.sex === "F" ? "FEMININO" : "MASCULINO"} · {sel.sector}</p></div><button onClick={() => nav({ to: "/evolucao/$id", params: { id: sel.id } })} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-navy text-navy-foreground text-xs font-bold uppercase tracking-wide hover:opacity-90">ABRIR EVOLUÇÃO →</button></div>
                <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">{[{ label: "ADMISSÃO", value: sel.admission ? sel.admission.split("-").reverse().join("/") : "—" }, { label: "ATB", value: sel.data?.abx?.[0]?.name || "NÃO" }, { label: "ALERGIAS", value: "NÃO REFERIDO" }, { label: "ÚLTIMA EVOL.", value: sel.status === "EVOLUÇÃO GERADA" ? "HOJE" : "PENDENTE" }].map((m) => (<div key={m.label} className="rounded-lg bg-secondary p-3"><div className="label-tech text-[10px]">{m.label}</div><div className="font-bold text-sm mt-1 truncate">{m.value}</div></div>))}</div>
                {sel.hda && <div className="mt-6 rounded-lg border border-border p-4"><div className="label-tech mb-2">HISTÓRIA DA DOENÇA ATUAL</div><p className="text-sm leading-relaxed">{sel.hda}</p></div>}
                {sel.status === "ALERTA RENAL" && <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/5 p-4 flex gap-3"><AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" /><div><div className="font-bold text-destructive text-sm">ATENÇÃO RENAL</div><p className="text-sm mt-1">Verificar ajuste de dose de medicamentos com excreção renal.</p></div></div>}
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
