import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { getPatientsByShift, createHandoff } from "@/lib/db";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { format, parseISO, differenceInDays, isValid } from "date-fns";
import { toast } from "sonner";
import { ChevronLeft, Save, Download, Loader2, Sparkles, RotateCcw, Wand2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ShiftBadge from "@/components/ShiftBadge";
import { invokeEdgeFunction } from "@/lib/edgeFunctions";
import { storage } from "@/lib/storage";

export const Route = createFileRoute("/passagem")({
  component: PassagemPage,
  head: () => ({ meta: [{ title: "Passagem de Plantão — PLANTONISTA" }] }),
});

type Narrativas = Record<string, string>;

function PassagemPage() {
  const nav = useNavigate();
  const { userId } = useSupabaseUser();
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [shiftData, setShiftData] = useState<any>(null);
  const [narrativas, setNarrativas] = useState<Narrativas>({});
  const [gerandoIds, setGerandoIds] = useState<Set<string>>(new Set());
  const [gerandoTudo, setGerandoTudo] = useState(false);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    async function load() {
      try {
        const shiftId = localStorage.getItem("da_shift_id");
        const plantaoAtivo = JSON.parse(localStorage.getItem("da_plantao_ativo") || "{}");
        setShiftData(plantaoAtivo);

        if (shiftId && !shiftId.startsWith("temp_")) {
          const dbPatients = await getPatientsByShift(shiftId, userId!);
          setPacientes(dbPatients);
        } else {
          const all = JSON.parse(localStorage.getItem("da_pacientes") || "[]");
          setPacientes(all);
        }

        // Restaura narrativas salvas localmente
        const cached = localStorage.getItem(`da_passagem_narrativas_${shiftId || "local"}`);
        if (cached) setNarrativas(JSON.parse(cached));
      } catch (err) {
        console.warn("Failed to load shift patients", err);
        const all = JSON.parse(localStorage.getItem("da_pacientes") || "[]");
        setPacientes(all);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [userId]);

  // Auto-persiste narrativas em localStorage (debounce 500ms)
  useEffect(() => {
    const shiftId = localStorage.getItem("da_shift_id") || "local";
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(`da_passagem_narrativas_${shiftId}`, JSON.stringify(narrativas));
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [narrativas]);

  const calculateDValue = (startDateStr: string) => {
    const start = parseISO(startDateStr);
    if (!isValid(start)) return "D?";
    const diff = differenceInDays(new Date(), start);
    return `D${diff >= 0 ? diff : 0}`;
  };

  const getProblemListText = (p: any) => {
    const problems = p.problem_list || p.lista_de_problemas || [];
    if (typeof problems[0] === "string") return problems.join("; ");
    return problems.map((x: any) => x.text || x).join("; ");
  };

  const getAtbText = (p: any) => {
    const atb = p.antibiotics || p.antibioticos || [];
    return atb.map((a: any) => `${a.nome || a.name} (${calculateDValue(a.data_inicio || a.dataInicio)})`).join(", ");
  };

  const getPendenciasText = (p: any) => {
    const pend = p.pending_issues || p.pendencias || [];
    if (typeof pend[0] === "string") return pend.join("; ");
    return pend.map((x: any) => x.text || x).join("; ");
  };

  const sortedPacientes = useMemo(() => {
    return [...pacientes].sort((a, b) => {
      const numA = parseInt((a.bed || a.leito || "").replace(/\D/g, "")) || 0;
      const numB = parseInt((b.bed || b.leito || "").replace(/\D/g, "")) || 0;
      return numA - numB;
    });
  }, [pacientes]);

  const gerarNarrativa = async (p: any): Promise<string> => {
    const result = await invokeEdgeFunction<{ narrativa?: string; error?: string }>(
      "handoff-per-patient",
      {
        patient: p,
        atb_day_rule: storage.getAtbDayRule(),
      },
      { timeoutMs: 90_000 },
    );
    if (result.error) throw new Error(result.error);
    return (result.narrativa || "").trim();
  };

  const handleGerarUm = async (p: any) => {
    const id = p.id || p._id || p.name;
    setGerandoIds((prev) => new Set(prev).add(id));
    try {
      const narrativa = await gerarNarrativa(p);
      setNarrativas((prev) => ({ ...prev, [id]: narrativa }));
      toast.success(`Narrativa gerada: ${p.name || p.nome}`);
    } catch (err: any) {
      toast.error(`Falha: ${err.message || err}`);
    } finally {
      setGerandoIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleGerarTodos = async () => {
    if (gerandoTudo) return;
    setGerandoTudo(true);
    let ok = 0;
    let falhas = 0;
    for (const p of sortedPacientes) {
      const id = p.id || p._id || p.name;
      if (narrativas[id]?.trim()) continue; // pula já gerados
      setGerandoIds((prev) => new Set(prev).add(id));
      try {
        const narrativa = await gerarNarrativa(p);
        setNarrativas((prev) => ({ ...prev, [id]: narrativa }));
        ok++;
      } catch {
        falhas++;
      } finally {
        setGerandoIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    }
    setGerandoTudo(false);
    toast.success(`${ok} gerada(s)${falhas ? `, ${falhas} falha(s)` : ""}.`);
  };

  const handleEditarNarrativa = (id: string, valor: string) => {
    setNarrativas((prev) => ({ ...prev, [id]: valor }));
  };

  const generateText = () => {
    let text = `PASSAGEM DE PLANTÃO — ${shiftData?.setor || "Setor"} — ${format(new Date(), "dd/MM/yyyy")}\n\n`;
    sortedPacientes.forEach((p) => {
      const id = p.id || p._id || p.name;
      const narrativa = (narrativas[id] || "").trim();
      if (narrativa) {
        text += `${narrativa}\n\n`;
      } else {
        text += `LEITO ${p.bed || p.leito} - ${p.name || p.nome}\n`;
        text += `Admissão: ${p.admission_date || p.data_admissao || "-"}\n`;
        text += `Problemas: ${getProblemListText(p) || "Nenhum"}\n`;
        text += `ATB: ${getAtbText(p) || "Nenhum"}\n`;
        text += `Pendências: ${getPendenciasText(p) || "Nenhuma"}\n\n`;
      }
    });
    return text;
  };

  const handleSave = async () => {
    if (!userId) return;
    setIsSaving(true);
    const textoPassagem = generateText();
    const shiftId = localStorage.getItem("da_shift_id");

    try {
      if (shiftId && !shiftId.startsWith("temp_")) {
        await createHandoff({ shift_id: shiftId, content: textoPassagem }, userId);
        toast.success("Passagem salva!");
      } else {
        throw new Error("Local fallback");
      }
    } catch (error) {
      console.warn("Salvando passagem localmente", error);
      const existing = JSON.parse(localStorage.getItem("da_passagens") || "[]");
      existing.push({ shift_id: shiftId, content: textoPassagem, created_at: new Date().toISOString() });
      localStorage.setItem("da_passagens", JSON.stringify(existing));
      toast.success("Passagem salva localmente!");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF("landscape", "mm", "a4");

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    const dataFormatada = format(new Date(), "dd/MM/yyyy");
    doc.text(`PASSAGEM DE PLANTÃO — ${shiftData?.setor || "Setor"} — ${dataFormatada} — Dr(a). ${shiftData?.medico || "Médico"}`, 14, 15);

    const tableData = sortedPacientes.map((p) => [
      `${p.name || p.nome}\nLeito: ${p.bed || p.leito}`,
      getProblemListText(p),
      getAtbText(p),
      p.admission_date || p.data_admissao || "-",
      getPendenciasText(p),
    ]);

    autoTable(doc, {
      startY: 25,
      head: [["Paciente/Leito", "Problemas", "ATB + D", "Admissão", "Pendências"]],
      body: tableData,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185] },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 60 },
        2: { cellWidth: 40 },
        3: { cellWidth: 25 },
        4: { cellWidth: "auto" },
      },
    });

    let y = (doc as any).lastAutoTable.finalY || 25;

    // Seção narrativa por paciente (se houver alguma)
    const comNarrativa = sortedPacientes.filter((p) => {
      const id = p.id || p._id || p.name;
      return (narrativas[id] || "").trim();
    });
    if (comNarrativa.length > 0) {
      y += 12;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("NARRATIVA POR PACIENTE", 14, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      for (const p of comNarrativa) {
        const id = p.id || p._id || p.name;
        const lines = doc.splitTextToSize((narrativas[id] || "").trim(), 270);
        const blockHeight = lines.length * 4.5 + 4;
        if (y + blockHeight > 200) {
          doc.addPage("landscape");
          y = 15;
        }
        doc.setFont("helvetica", "bold");
        doc.text(`Leito ${p.bed || p.leito} — ${p.name || p.nome}`, 14, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        doc.text(lines, 14, y);
        y += blockHeight;
      }
    }

    const totalPatients = sortedPacientes.length;
    const totalAtb = sortedPacientes.filter((p) => getAtbText(p).length > 0).length;
    const totalPend = sortedPacientes.filter((p) => getPendenciasText(p).length > 0).length;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Total: ${totalPatients} pacientes · ${totalAtb} com ATB · ${totalPend} pendências`, 14, Math.min(y + 8, 200));

    doc.save(`passagem_${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast.success("PDF gerado com sucesso!");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const totalNarrativas = Object.values(narrativas).filter((n) => n?.trim()).length;
  const totalPendentes = sortedPacientes.length - totalNarrativas;

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="bg-elevated border-b border-border sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-6 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-4">
            <button onClick={() => nav({ to: "/dashboard" })} className="h-10 w-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-black text-foreground uppercase tracking-tight">MAPA DE PASSAGEM</h1>
                <ShiftBadge silent />
              </div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{shiftData?.setor || "Setor"} · {format(new Date(), "dd/MM/yyyy")}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleGerarTodos}
              disabled={gerandoTudo || sortedPacientes.length === 0}
              className="px-5 py-2.5 rounded-xl bg-ai text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-ai/20 hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {gerandoTudo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
              {gerandoTudo
                ? `IA ${totalNarrativas}/${sortedPacientes.length}`
                : totalPendentes > 0
                  ? `GERAR ${totalPendentes} COM IA`
                  : "REGENERAR TUDO"}
            </button>
            <button onClick={handleExportPDF} className="px-5 py-2.5 rounded-xl border border-border text-[10px] font-black uppercase tracking-widest hover:bg-secondary transition-all flex items-center gap-2">
              <Download className="h-3 w-3" /> PDF
            </button>
            <button onClick={handleSave} disabled={isSaving} className="px-5 py-2.5 rounded-xl bg-navy text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-navy/20 hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50">
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} SALVAR
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-12 space-y-6">
        {sortedPacientes.length === 0 ? (
          <div className="bg-elevated border border-border rounded-[2rem] p-12 text-center">
            <p className="text-sm text-muted-foreground italic">Nenhum paciente cadastrado no plantão.</p>
          </div>
        ) : (
          sortedPacientes.map((p, idx) => {
            const id = p.id || p._id || p.name;
            const narrativa = narrativas[id] || "";
            const gerando = gerandoIds.has(id);
            return (
              <article key={idx} className="bg-elevated border border-border rounded-[1.5rem] shadow-sm overflow-hidden">
                <header className="flex items-center justify-between gap-3 p-4 border-b border-border bg-subtle/30 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">LEITO {p.bed || p.leito}</p>
                    <h2 className="text-base font-black text-foreground uppercase truncate">{p.name || p.nome}</h2>
                  </div>
                  <button
                    onClick={() => handleGerarUm(p)}
                    disabled={gerando || gerandoTudo}
                    className="px-3 py-2 rounded-lg bg-ai/10 text-ai border border-ai/20 text-[10px] font-black uppercase tracking-widest hover:bg-ai/15 transition-all flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                  >
                    {gerando ? <Loader2 className="h-3 w-3 animate-spin" /> : narrativa ? <RotateCcw className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                    {gerando ? "GERANDO…" : narrativa ? "REGENERAR" : "GERAR COM IA"}
                  </button>
                </header>

                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 text-xs">
                    <div>
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">PROBLEMAS</p>
                      <p className="text-foreground">{getProblemListText(p) || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">ATB + D</p>
                      <p className="text-ai font-bold">{getAtbText(p) || "—"}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">PENDÊNCIAS</p>
                      <p className="text-amber-700 dark:text-amber-400">{getPendenciasText(p) || "—"}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-ai" /> NARRATIVA IA (EDITÁVEL)
                    </p>
                    <textarea
                      value={narrativa}
                      onChange={(e) => handleEditarNarrativa(id, e.target.value)}
                      placeholder={gerando ? "Gerando…" : "Clique em 'Gerar com IA' acima ou escreva manualmente."}
                      className="w-full min-h-[120px] bg-background border border-border rounded-lg p-3 text-[12px] font-medium text-foreground leading-relaxed focus:outline-none focus:ring-2 focus:ring-ai/30 resize-y"
                    />
                  </div>
                </div>
              </article>
            );
          })
        )}
      </main>
    </div>
  );
}
