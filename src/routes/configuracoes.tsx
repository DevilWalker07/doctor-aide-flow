import { createFileRoute, Link } from "@tanstack/react-router";
import { 
  ChevronLeft, User, Stethoscope, Shield, 
  Settings2, Activity, Info, Globe, 
  CheckCircle2, XCircle, RefreshCw, Save
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { VITE_CLINICAL_AGENTS_URL } from "@/lib/clinicalAgentsConfig";

export const Route = createFileRoute("/configuracoes")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Configurações — DOUTOR AJUDA" }] }),
});

function SettingsPage() {
  // Medical Profile
  const [nomeMedico, setNomeMedico] = useState(() => localStorage.getItem("da_nome_medico") || "");
  const [crm, setCrm] = useState(() => localStorage.getItem("da_crm") || "");
  const [especialidade, setEspecialidade] = useState(() => localStorage.getItem("da_especialidade") || "");
  const [hospitalPadrao, setHospitalPadrao] = useState(() => localStorage.getItem("da_hospital_padrao") || "");

  // ATB Rules
  const [atbDayRule, setAtbDayRule] = useState(() => localStorage.getItem("da_atb_day_rule") || "D0");
  const [atbAlertDays, setAtbAlertDays] = useState(() => localStorage.getItem("da_atb_alert_days") || "7");

  // AI Status
  const [aiStatus, setAiStatus] = useState<"loading" | "connected" | "disconnected">("loading");

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    setAiStatus("loading");
    try {
      const response = await fetch(`${VITE_CLINICAL_AGENTS_URL}/health`);
      if (response.ok) setAiStatus("connected");
      else setAiStatus("disconnected");
    } catch {
      setAiStatus("disconnected");
    }
  };

  const saveProfile = () => {
    localStorage.setItem("da_nome_medico", nomeMedico);
    localStorage.setItem("da_crm", crm);
    localStorage.setItem("da_especialidade", especialidade);
    localStorage.setItem("da_hospital_padrao", hospitalPadrao);
    toast.success("Perfil médico atualizado!");
  };

  const saveRules = () => {
    localStorage.setItem("da_atb_day_rule", atbDayRule);
    localStorage.setItem("da_atb_alert_days", atbAlertDays);
    toast.success("Regras clínicas salvas!");
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="bg-white border-b border-border sticky top-0 z-30 shadow-sm overflow-hidden">
        <div className="absolute top-0 left-0 w-1 bg-navy h-full" />
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
           <Link to="/dashboard" className="h-10 w-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary transition-all">
              <ChevronLeft className="h-5 w-5" />
           </Link>
           <h1 className="text-sm font-black tracking-[0.2em] uppercase text-foreground">CONFIGURAÇÕES DO SISTEMA</h1>
           <div className="w-10" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-12">
         
         {/* 1. PERFIL MÉDICO */}
         <Section title="PERFIL MÉDICO" icon={<User className="h-5 w-5" />}>
            <div className="grid md:grid-cols-2 gap-6">
               <div className="space-y-1">
                  <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">NOME COMPLETO</label>
                  <input value={nomeMedico} onChange={e => setNomeMedico(e.target.value.toUpperCase())} className={inputCls} placeholder="DR(A). NOME SOBRENOME" />
               </div>
               <div className="space-y-1">
                  <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">CRM / REGISTRO</label>
                  <input value={crm} onChange={e => setCrm(e.target.value.toUpperCase())} className={inputCls} placeholder="EX: 123456-SP" />
               </div>
               <div className="space-y-1">
                  <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">ESPECIALIDADE</label>
                  <input value={especialidade} onChange={e => setEspecialidade(e.target.value.toUpperCase())} className={inputCls} placeholder="EX: CLÍNICA MÉDICA" />
               </div>
               <div className="space-y-1">
                  <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest ml-1">HOSPITAL PADRÃO</label>
                  <input value={hospitalPadrao} onChange={e => setHospitalPadrao(e.target.value.toUpperCase())} className={inputCls} placeholder="EX: HOSPITAL NAIR ALVES" />
               </div>
            </div>
            <button onClick={saveProfile} className="w-full mt-4 py-4 rounded-2xl bg-navy text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-navy/20 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
               <Save className="h-4 w-4" /> SALVAR PERFIL
            </button>
         </Section>

         {/* 2. REGRAS DE ANTIBIÓTICO */}
         <Section title="REGRAS DE ANTIBIÓTICO" icon={<Activity className="h-5 w-5" />}>
            <div className="space-y-6">
               <div className="space-y-4">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">REGRA DE CONTAGEM (D-DAY)</label>
                  <div className="grid grid-cols-2 gap-4">
                     {[
                        { id: "D0", label: "D0 = DIA DE INÍCIO", desc: "Contagem inicia no dia da primeira dose" },
                        { id: "D1", label: "D1 = DIA COMPLETO", desc: "Contagem inicia após 24h da primeira dose" }
                     ].map(opt => (
                        <button 
                           key={opt.id} 
                           onClick={() => setAtbDayRule(opt.id)}
                           className={`p-6 rounded-[2rem] border text-left transition-all ${atbDayRule === opt.id ? 'bg-primary/5 border-primary ring-1 ring-primary' : 'bg-white border-border hover:border-primary/40'}`}
                        >
                           <p className="text-[10px] font-black uppercase tracking-widest mb-1">{opt.label}</p>
                           <p className="text-[9px] text-muted-foreground font-bold">{opt.desc}</p>
                        </button>
                     ))}
                  </div>
               </div>

               <div className="space-y-4">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">ALERTA DE CICLO PROLONGADO</label>
                  <div className="flex items-center gap-4">
                     <span className="text-xs font-bold text-foreground">NOTIFICAR SE ATB HÁ MAIS DE</span>
                     <input 
                        type="number" 
                        value={atbAlertDays} 
                        onChange={e => setAtbAlertDays(e.target.value)}
                        className="w-20 bg-secondary/30 border border-border rounded-xl px-4 py-2 text-center font-black" 
                     />
                     <span className="text-xs font-bold text-foreground">DIAS</span>
                  </div>
               </div>
            </div>
            <button onClick={saveRules} className="w-full mt-8 py-4 rounded-2xl bg-secondary text-foreground text-[10px] font-black uppercase tracking-widest border border-border hover:bg-secondary/80 transition-all flex items-center justify-center gap-2">
               <Save className="h-4 w-4" /> SALVAR REGRAS
            </button>
         </Section>

         {/* 3. BACKEND DE IA */}
         <Section title="BACKEND DE IA" icon={<Globe className="h-5 w-5" />}>
            <div className="flex items-center justify-between p-6 bg-secondary/30 rounded-[2rem] border border-border">
               <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-2xl bg-white flex items-center justify-center border border-border shadow-sm">
                     <RefreshCw className={`h-5 w-5 text-primary ${aiStatus === 'loading' ? 'animate-spin' : ''}`} />
                  </div>
                  <div>
                     <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">STATUS DA CONEXÃO</p>
                     <div className="flex items-center gap-1.5">
                        {aiStatus === 'connected' ? (
                           <>
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              <span className="text-[11px] font-black text-emerald-600 uppercase">CONECTADO AO RAILWAY</span>
                           </>
                        ) : aiStatus === 'disconnected' ? (
                           <>
                              <XCircle className="h-3.5 w-3.5 text-destructive" />
                              <span className="text-[11px] font-black text-destructive uppercase">DESCONECTADO</span>
                           </>
                        ) : (
                           <span className="text-[11px] font-black text-muted-foreground uppercase">VERIFICANDO...</span>
                        )}
                     </div>
                  </div>
               </div>
               <button onClick={checkHealth} className="px-6 py-2.5 rounded-xl border border-border text-[9px] font-black uppercase tracking-widest bg-white hover:bg-secondary transition-all">
                  TESTAR CONEXÃO
               </button>
            </div>
         </Section>

         {/* 4. SOBRE O APP */}
         <Section title="SOBRE O APP" icon={<Info className="h-5 w-5" />}>
            <div className="text-center space-y-4">
               <div className="h-20 w-20 bg-navy rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-navy/20">
                  <span className="text-2xl font-black text-white italic">DA</span>
               </div>
               <div>
                  <h3 className="text-lg font-black text-foreground tracking-tight">DOUTOR AJUDA — FASE 2</h3>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">ASSISTENTE CLÍNICO INTELIGENTE · VERSÃO 2.0</p>
               </div>
               <div className="flex justify-center gap-6 pt-4">
                  <a href="#" className="text-[10px] font-black text-primary hover:underline uppercase tracking-widest">TERMOS DE USO</a>
                  <a href="#" className="text-[10px] font-black text-primary hover:underline uppercase tracking-widest">PRIVACIDADE</a>
               </div>
            </div>
         </Section>

      </main>
    </div>
  );
}

function Section({ title, icon, children }: { title: string, icon: any, children: any }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 mb-6 ml-1">
        <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground border border-border/50">
          {icon}
        </div>
        <h2 className="text-[10px] font-black tracking-[0.25em] uppercase text-foreground">{title}</h2>
      </div>
      <div className="bg-white border border-border rounded-[3rem] p-8 md:p-12 shadow-sm">
        {children}
      </div>
    </div>
  );
}

const inputCls = "w-full bg-secondary/40 border border-border rounded-xl px-5 py-4 text-sm font-bold placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white transition-all uppercase";
