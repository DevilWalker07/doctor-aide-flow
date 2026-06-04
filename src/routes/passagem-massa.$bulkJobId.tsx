import { createFileRoute, useParams, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Loader2, AlertTriangle, CheckCircle2, Copy, FileText, RefreshCw, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { getBulkExtractionJob, type BulkJobStatus, type PassagemRankingItem } from "@/lib/documentExtractor";
import { storage } from "@/lib/storage";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";

export const Route = createFileRoute("/passagem-massa/$bulkJobId")({
  component: PassagemMassaPage,
  head: () => ({ meta: [{ title: "Passagem de Plantão — DOUTOR AJUDA" }] }),
});

const POLL_INTERVAL_MS = 2500;
const TIMEOUT_MS = 10 * 60 * 1000; // 10 min

const GRAVIDADE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  critico: { bg: "bg-red-600", text: "text-white", label: "CRÍTICO" },
  grave: { bg: "bg-orange-500", text: "text-white", label: "GRAVE" },
  moderado: { bg: "bg-amber-400", text: "text-amber-950", label: "MODERADO" },
  leve: { bg: "bg-emerald-500", text: "text-white", label: "LEVE" },
};

function PassagemMassaPage() {
  const { bulkJobId } = useParams({ from: "/passagem-massa/$bulkJobId" });
  const nav = useNavigate();
  const { userId } = useSupabaseUser();
  const [job, setJob] = useState<BulkJobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addingAll, setAddingAll] = useState(false);
  const addedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const start = Date.now();

    const poll = async () => {
      if (cancelled) return;
      if (Date.now() - start > TIMEOUT_MS) {
        setError("Tempo limite excedido. Tente novamente.");
        return;
      }
      try {
        const j = await getBulkExtractionJob(bulkJobId);
        if (cancelled) return;
        setJob(j);
        if (j.status === "done" || j.status === "error") return;
        setTimeout(poll, POLL_INTERVAL_MS);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "Erro ao consultar o lote.");
        }
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [bulkJobId]);

  const ranking: PassagemRankingItem[] = job?.passagem?.ranking || [];
  const passagemTexto = job?.passagem?.passagem_texto || "";
  const contagem = job?.passagem?.contagem;

  const adicionarTodos = async () => {
    if (!job || addedRef.current) return;
    setAddingAll(true);
    try {
      const existing = storage.getLocalPacientes();
      const byKey = new Map<string, any>();
      for (const p of existing) byKey.set(keyOf(p), p);

      const novos: any[] = [];
      let mergedCount = 0;
      for (const p of job.patients) {
        const mapped = mapExtractedToLocal(p);
        const k = keyOf(mapped);
        const found = byKey.get(k);
        if (found) {
          const merged = storage.mergeLocalPatient(found.id, mapped);
          if (merged) mergedCount += 1;
        } else {
          const id = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const shiftId = storage.getShiftId();
          const plantao = storage.getPlantaoAtivo();
          novos.push({
            ...mapped,
            id,
            shift_id: shiftId || undefined,
            setor: mapped.setor || plantao?.setor || undefined,
            created_at: new Date().toISOString(),
          });
        }
      }
      if (novos.length) {
        storage.setLocalPacientes([...existing, ...novos]);
      }

      addedRef.current = true;
      toast.success(`${novos.length} paciente(s) adicionado(s)${mergedCount ? `, ${mergedCount} atualizado(s)` : ""}.`);
      nav({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(`Falha ao adicionar: ${err.message}`);
    } finally {
      setAddingAll(false);
    }
  };

  const copyPassagem = () => {
    if (!passagemTexto) return;
    navigator.clipboard.writeText(passagemTexto);
    toast.success("Passagem copiada.");
  };

  if (error) {
    return (
      <Shell title="Erro">
        <div className="text-center py-20">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-sm font-bold uppercase tracking-widest">{error}</p>
          <button onClick={() => location.reload()} className="mt-6 px-6 py-3 rounded-xl bg-navy text-white text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2">
            <RefreshCw className="h-3 w-3" /> TENTAR DE NOVO
          </button>
        </div>
      </Shell>
    );
  }

  if (!job) return <Shell title="Carregando"><Spinner label="Conectando ao lote..." /></Shell>;

  if (job.status !== "done") {
    const total = job.total || 0;
    const done = job.progress?.done || 0;
    const errs = job.progress?.error || 0;
    const pct = total ? Math.round(((done + errs) / total) * 100) : 0;
    return (
      <Shell title="Processando lote">
        <div className="space-y-8 max-w-2xl mx-auto py-12">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-6" />
            <h2 className="text-2xl font-black uppercase tracking-tight mb-2">Lendo prontuários</h2>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              {job.stage || "Aguardando..."}
            </p>
          </div>

          <div className="bg-elevated border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-3">
              <span>{done + errs} de {total}</span>
              <span>{pct}%</span>
            </div>
            <div className="h-3 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className="space-y-2">
            {(job.sub_status || []).map((s) => (
              <div key={s.sub_job_id} className="flex items-center gap-3 px-4 py-3 bg-elevated border border-border rounded-xl text-xs">
                {s.status === "done" && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                {s.status === "error" && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
                {(s.status === "processing" || s.status === "queued") && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
                <span className="flex-1 truncate font-bold">{s.file_name}</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{s.status}</span>
              </div>
            ))}
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Passagem de Plantão">
      <div className="space-y-8 py-8">
        {contagem && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(["critico", "grave", "moderado", "leve"] as const).map((g) => (
              <div key={g} className={`p-4 rounded-2xl text-center ${GRAVIDADE_STYLES[g].bg} ${GRAVIDADE_STYLES[g].text}`}>
                <p className="text-3xl font-black">{contagem[g] ?? 0}</p>
                <p className="text-[9px] font-black uppercase tracking-widest opacity-90">{GRAVIDADE_STYLES[g].label}</p>
              </div>
            ))}
          </div>
        )}

        {job.errors && job.errors.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-900 dark:text-amber-300 mb-2">
              {job.errors.length} arquivo(s) com erro
            </p>
            {job.errors.slice(0, 5).map((e, i) => (
              <p key={i} className="text-[10px] font-bold text-amber-900 dark:text-amber-300">• {e.file_name}: {e.error}</p>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-3 justify-end">
          <button
            onClick={copyPassagem}
            disabled={!passagemTexto}
            className="px-6 py-3 rounded-xl border border-border bg-elevated text-[10px] font-black uppercase tracking-widest hover:bg-secondary transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <Copy className="h-3 w-3" /> COPIAR PASSAGEM
          </button>
          <button
            onClick={adicionarTodos}
            disabled={addingAll || !userId || job.patients.length === 0}
            className="px-6 py-3 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {addingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowRight className="h-3 w-3" />}
            ADICIONAR {job.patients.length} AO PLANTÃO
          </button>
        </div>

        <div className="space-y-3">
          {ranking.map((p, i) => {
            const style = GRAVIDADE_STYLES[p.gravidade] || GRAVIDADE_STYLES.moderado;
            return (
              <div key={`${p.fileName}-${i}`} className="bg-elevated border border-border rounded-2xl p-5 shadow-sm hover:border-primary/40 transition-colors">
                <div className="flex items-start gap-4 flex-wrap">
                  <div className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${style.bg} ${style.text}`}>
                    {style.label}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-black uppercase">
                      {p.leito ? `LEITO ${p.leito} · ` : ""}{p.nome || "SEM NOME"}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">{p.resumo_uma_linha}</p>
                    <div className="flex flex-wrap gap-3 mt-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {p.dias_de_internacao != null && <span>DIH {p.dias_de_internacao}</span>}
                      {p.dias_de_antibiotico != null && <span>ATB D{p.dias_de_antibiotico}</span>}
                      {p.sugere_alta && <span className="text-emerald-600 font-black">↑ ALTA SUGERIDA</span>}
                    </div>
                    {p.alertas_pendencias && p.alertas_pendencias.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {p.alertas_pendencias.map((a, ai) => (
                          <li key={ai} className="text-[10px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> {a}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {passagemTexto && (
          <div className="bg-elevated border border-border rounded-[2rem] p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-xs font-black uppercase tracking-[0.2em]">PASSAGEM CONSOLIDADA</h2>
            </div>
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground uppercase max-h-[600px] overflow-y-auto custom-scrollbar">{passagemTexto}</pre>
          </div>
        )}
      </div>
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: any }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-elevated border-b border-border sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/upload-ia" search={{ tipo: "admissao", engine: "docling", modo: "lote", patient_id: undefined }} className="h-10 w-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-sm font-black uppercase tracking-[0.2em]">{title}</h1>
          <div className="w-10" />
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6">{children}</main>
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="py-20 flex flex-col items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
      <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}

function keyOf(p: any): string {
  const nome = String(p.nome || p.name || "").trim().toLowerCase();
  const leito = String(p.leito || p.bed || "").trim().toLowerCase();
  return `${nome}|${leito}`;
}

function mapExtractedToLocal(p: any): any {
  return {
    nome: p.nome || null,
    name: p.nome || null,
    idade: p.idade ?? null,
    age: p.idade ?? null,
    sexo: p.sexo || null,
    sex: p.sexo || null,
    leito: p.leito || null,
    bed: p.leito || null,
    setor: p.setor || null,
    sector: p.setor || null,
    data_admissao: p.data_admissao || null,
    admission_date: p.data_admissao || null,
    reason_for_admission: p.motivo_admissao || null,
    hda: p.hda || null,
    problem_list: Array.from(new Set([...(p.problemas_ativos || []), ...(p.lista_de_problemas || [])])),
    antibioticos: (p.antibioticos || []).map((a: any) => ({
      nome: a.nome,
      dose: a.dose,
      via: a.via,
      frequencia: a.frequencia,
      dataInicio: a.data_inicio,
      data_inicio: a.data_inicio,
    })),
    antibiotics: (p.antibioticos || []).map((a: any) => ({
      nome: a.nome,
      data_inicio: a.data_inicio,
    })),
    medications: p.medicacoes_uso_continuo || p.medicacoes || [],
    laboratorios: p.laboratorios || [],
    labs: p.laboratorios || [],
    exame_fisico: p.exame_fisico_detalhado || {},
    physical_exam: p.exame_fisico_detalhado || {},
    conducts: p.condutas || [],
    pending_issues: p.pendencias || [],
    pendencias: (p.pendencias || []).map((t: string) => ({ text: t })),
  };
}
