import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { getPatientsByShift, createHandoff } from "@/lib/db";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { format, parseISO, differenceInDays, isValid } from "date-fns";
import { toast } from "sonner";
import { ChevronLeft, Save, Download, FileText, Loader2 } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ShiftBadge from "@/components/ShiftBadge";

export const Route = createFileRoute("/passagem")({
  component: PassagemPage,
  head: () => ({ meta: [{ title: "Passagem de Plantão — DOUTOR AJUDA" }] }),
});

function PassagemPage() {
  const nav = useNavigate();
  const { userId } = useSupabaseUser();
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [shiftData, setShiftData] = useState<any>(null);

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
          // fallback
          const all = JSON.parse(localStorage.getItem("da_pacientes") || "[]");
          setPacientes(all);
        }
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

  const generateText = () => {
    let text = `PASSAGEM DE PLANTÃO — ${shiftData?.setor || "Setor"} — ${format(new Date(), "dd/MM/yyyy")}\n\n`;
    sortedPacientes.forEach(p => {
      text += `LEITO ${p.bed || p.leito} - ${p.name || p.nome}\n`;
      text += `Admissão: ${p.admission_date || p.data_admissao || "-"}\n`;
      text += `Problemas: ${getProblemListText(p) || "Nenhum"}\n`;
      text += `ATB: ${getAtbText(p) || "Nenhum"}\n`;
      text += `Pendências: ${getPendenciasText(p) || "Nenhuma"}\n\n`;
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
    
    // Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    const dataFormatada = format(new Date(), "dd/MM/yyyy");
    doc.text(`PASSAGEM DE PLANTÃO — ${shiftData?.setor || "Setor"} — ${dataFormatada} — Dr(a). ${shiftData?.medico || "Médico"}`, 14, 15);
    
    const tableData = sortedPacientes.map(p => [
      `${p.name || p.nome}\nLeito: ${p.bed || p.leito}`,
      getProblemListText(p),
      getAtbText(p),
      p.admission_date || p.data_admissao || "-",
      getPendenciasText(p)
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
        4: { cellWidth: "auto" }
      }
    });

    // Footer
    const totalPatients = sortedPacientes.length;
    const totalAtb = sortedPacientes.filter(p => getAtbText(p).length > 0).length;
    const totalPend = sortedPacientes.filter(p => getPendenciasText(p).length > 0).length;
    
    doc.setFontSize(10);
    const finalY = (doc as any).lastAutoTable.finalY || 25;
    doc.text(`Total: ${totalPatients} pacientes · ${totalAtb} com ATB · ${totalPend} pendências`, 14, finalY + 10);

    doc.save(`passagem_${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast.success("PDF gerado com sucesso!");
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="bg-elevated border-b border-border sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
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
          <div className="flex gap-3">
             <button onClick={handleExportPDF} className="px-6 py-2.5 rounded-xl border border-border text-[10px] font-black uppercase tracking-widest hover:bg-secondary transition-all flex items-center gap-2">
                <Download className="h-3 w-3" /> EXPORTAR PDF
             </button>
             <button onClick={handleSave} disabled={isSaving} className="px-6 py-2.5 rounded-xl bg-navy text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-navy/20 hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50">
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} SALVAR PASSAGEM
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="bg-elevated border border-border rounded-[2rem] shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-secondary/50 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
              <tr>
                <th className="p-4 border-b border-border">Paciente/Leito</th>
                <th className="p-4 border-b border-border">Problemas</th>
                <th className="p-4 border-b border-border">ATB + D</th>
                <th className="p-4 border-b border-border">Admissão</th>
                <th className="p-4 border-b border-border">Pendências</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedPacientes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground italic text-xs">Nenhum paciente cadastrado no plantão.</td>
                </tr>
              ) : (
                sortedPacientes.map((p, idx) => (
                  <tr key={idx} className="hover:bg-secondary/20 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-foreground uppercase">{p.name || p.nome}</div>
                      <div className="text-xs text-muted-foreground">LEITO {p.bed || p.leito}</div>
                    </td>
                    <td className="p-4 text-xs font-medium max-w-[200px] truncate uppercase">{getProblemListText(p) || "-"}</td>
                    <td className="p-4 text-xs font-bold text-ai uppercase">{getAtbText(p) || "-"}</td>
                    <td className="p-4 text-xs text-muted-foreground">{p.admission_date || p.data_admissao || "-"}</td>
                    <td className="p-4 text-xs font-medium text-amber-600 max-w-[200px] truncate uppercase">{getPendenciasText(p) || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
