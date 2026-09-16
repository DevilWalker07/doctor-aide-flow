import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  User,
  Stethoscope,
  Shield,
  Settings2,
  Activity,
  Info,
  Globe,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Save,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
// Local sign-out: clears local user data only.
const useLocalSignOut = () => ({
  signOut: async (_opts?: { redirectUrl?: string }) => {
    localStorage.clear();
    window.location.href = "/";
  },
});
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { apiFetch } from "@/lib/apiClient";
import { getProfile, upsertProfile, getSettings, upsertSettings } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "@tanstack/react-router";
import { ThemeToggle } from "@/components/ThemeToggle";
import { storage } from "@/lib/storage";

export const Route = createFileRoute("/configuracoes")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Configurações — MEDFLUXO" }] }),
});

function SettingsPage() {
  const { userId } = useSupabaseUser();
  // Medical Profile
  const [nomeMedico, setNomeMedico] = useState(() => storage.getNomeMedico());
  const [crm, setCrm] = useState(() => storage.getCRM());
  const [especialidade, setEspecialidade] = useState(() => storage.getEspecialidade());
  const [hospitalPadrao, setHospitalPadrao] = useState(() => storage.getHospitalPadrao());

  // ATB Rules
  const [atbDayRule, setAtbDayRule] = useState(() => storage.getAtbDayRule());
  const [atbAlertDays, setAtbAlertDays] = useState(() => String(storage.getAtbAlertDays()));

  // AI Status
  const [aiStatus, setAiStatus] = useState<"loading" | "connected" | "disconnected">("loading");
  const nav = useNavigate();
  const { signOut } = useLocalSignOut();

  useEffect(() => {
    if (!userId) return;
    async function loadData() {
      try {
        const [profileRes, settingsRes] = await Promise.allSettled([
          getProfile(userId!),
          getSettings(userId!),
        ]);

        let loadedProfile = false;
        if (profileRes.status === "fulfilled" && profileRes.value) {
          setNomeMedico(profileRes.value.name || "");
          setCrm(profileRes.value.crm || "");
          setEspecialidade(profileRes.value.specialty || "");
          setHospitalPadrao(profileRes.value.hospital || "");

          // Sync to local
          storage.setNomeMedico(profileRes.value.name || "");
          storage.setCRM(profileRes.value.crm || "");
          storage.setEspecialidade(profileRes.value.specialty || "");
          storage.setHospitalPadrao(profileRes.value.hospital || "");
          loadedProfile = true;
        }

        let loadedSettings = false;
        if (settingsRes.status === "fulfilled" && settingsRes.value) {
          setAtbDayRule(settingsRes.value.atb_day_rule || "D0");
          setAtbAlertDays(String(settingsRes.value.atb_alert_days || "7"));

          // Sync to local
          storage.setAtbDayRule(settingsRes.value.atb_day_rule || "D0");
          storage.setAtbAlertDays(settingsRes.value.atb_alert_days || 7);
          loadedSettings = true;
        }

        if (!loadedProfile || !loadedSettings) {
          throw new Error("Partial load");
        }
      } catch (err) {
        console.warn("Using localStorage fallback for settings");
      }
    }
    loadData();
    checkHealth();
  }, [userId]);

  const checkHealth = async () => {
    setAiStatus("loading");
    try {
      const response = await apiFetch("/health");
      if (response.ok) setAiStatus("connected");
      else setAiStatus("disconnected");
    } catch {
      setAiStatus("disconnected");
    }
  };

  const saveProfile = async () => {
    if (!userId) return;
    try {
      await upsertProfile(
        { name: nomeMedico, crm, specialty: especialidade, hospital: hospitalPadrao },
        userId,
      );
      toast.success("Perfil salvo!");
    } catch (error) {
      console.warn(error);
      toast.success("Salvo localmente");
    }
    storage.setNomeMedico(nomeMedico);
    storage.setCRM(crm);
    storage.setEspecialidade(especialidade);
    storage.setHospitalPadrao(hospitalPadrao);
  };

  const saveRules = async () => {
    if (!userId) return;
    const days = parseInt(atbAlertDays) || 7;
    try {
      await upsertSettings({ atb_day_rule: atbDayRule, atb_alert_days: days }, userId);
      toast.success("Regras salvas!");
    } catch (error) {
      console.warn(error);
      toast.success("Salvo localmente");
    }
    storage.setAtbDayRule(atbDayRule);
    storage.setAtbAlertDays(days);
  };

  const handleExportData = async () => {
    if (!userId) return;
    try {
      const [
        { data: shifts },
        { data: patients },
        { data: evolutions },
        { data: prescriptions },
        { data: handoffs },
        { data: referrals },
      ] = await Promise.all([
        supabase.from("shifts").select("*").eq("user_id", userId),
        supabase.from("patients").select("*").eq("user_id", userId),
        supabase.from("evolutions").select("*").eq("user_id", userId),
        supabase.from("prescriptions").select("*").eq("user_id", userId),
        supabase.from("handoffs").select("*").eq("user_id", userId),
        supabase.from("referrals").select("*").eq("user_id", userId),
      ]);

      const backup = {
        exportado_em: new Date().toISOString(),
        medico: { nome: nomeMedico, crm, especialidade },
        plantoes: shifts || [],
        pacientes: patients || [],
        evolucoes: evolutions || [],
        prescricoes: prescriptions || [],
        passagens: handoffs || [],
        encaminhamentos: referrals || [],
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `doutor_ajuda_backup_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Download iniciado!");
    } catch (err) {
      toast.error("Erro ao exportar dados.");
      console.error(err);
    }
  };

  const handleLogout = async () => {
    storage.clearSession();
    await signOut({ redirectUrl: "/login" });
    nav({ to: "/login" });
  };

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="bg-card border-border sticky top-0 z-30 border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            to="/dashboard"
            aria-label="Voltar ao plantão"
            className="touch-target border-border text-muted-foreground hover:bg-secondary focus-visible:ring-ring inline-flex items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="t-title text-foreground">Configurações</h1>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
        {/* 1. PERFIL MÉDICO */}
        <Section title="Perfil médico" icon={<User className="h-5 w-5" />}>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="t-label text-muted-foreground">Nome completo</label>
              <input
                value={nomeMedico}
                onChange={(e) => setNomeMedico(e.target.value.toUpperCase())}
                className={inputCls}
                placeholder="DR(A). NOME SOBRENOME"
              />
            </div>
            <div className="space-y-1">
              <label className="t-label text-muted-foreground">CRM ou registro</label>
              <input
                value={crm}
                onChange={(e) => setCrm(e.target.value.toUpperCase())}
                className={inputCls}
                placeholder="EX: 123456-SP"
              />
            </div>
            <div className="space-y-1">
              <label className="t-label text-muted-foreground">Especialidade</label>
              <input
                value={especialidade}
                onChange={(e) => setEspecialidade(e.target.value.toUpperCase())}
                className={inputCls}
                placeholder="EX: CLÍNICA MÉDICA"
              />
            </div>
            <div className="space-y-1">
              <label className="t-label text-muted-foreground">Hospital padrão</label>
              <input
                value={hospitalPadrao}
                onChange={(e) => setHospitalPadrao(e.target.value.toUpperCase())}
                className={inputCls}
                placeholder="EX: HOSPITAL NAIR ALVES"
              />
            </div>
          </div>
          <button
            onClick={saveProfile}
            className="bg-navy text-navy-foreground focus-visible:ring-ring mt-5 inline-flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-2xl text-base font-bold transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
          >
            <Save className="h-5 w-5" aria-hidden="true" /> Salvar perfil
          </button>
        </Section>

        {/* 2. REGRAS DE ANTIBIÓTICO */}
        <Section title="Regras de antibiótico" icon={<Activity className="h-5 w-5" />}>
          <div className="space-y-6">
            <div className="space-y-4">
              <label className="t-label text-muted-foreground">REGRA DE CONTAGEM (D-DAY)</label>
              <div className="grid grid-cols-2 gap-4">
                {[
                  {
                    id: "D0",
                    label: "D0 = DIA DE INÍCIO",
                    desc: "Contagem inicia no dia da primeira dose",
                  },
                  {
                    id: "D1",
                    label: "D1 = DIA COMPLETO",
                    desc: "Contagem inicia após 24h da primeira dose",
                  },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setAtbDayRule(opt.id)}
                    className={`focus-visible:ring-ring rounded-2xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none ${atbDayRule === opt.id ? "bg-primary/5 border-primary ring-primary ring-1" : "bg-card border-border hover:border-primary/40"}`}
                  >
                    <p className="t-title text-foreground mb-1">{opt.label}</p>
                    <p className="t-body text-muted-foreground">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="t-label text-muted-foreground">ALERTA DE CICLO PROLONGADO</label>
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-foreground">
                  NOTIFICAR SE ATB HÁ MAIS DE
                </span>
                <input
                  type="number"
                  value={atbAlertDays}
                  onChange={(e) => setAtbAlertDays(e.target.value)}
                  className="w-20 bg-secondary/30 border border-border rounded-xl px-4 py-2 text-center font-black"
                />
                <span className="text-xs font-bold text-foreground">DIAS</span>
              </div>
            </div>
          </div>
          <button
            onClick={saveRules}
            className="bg-secondary text-foreground border-border hover:bg-border focus-visible:ring-ring mt-5 inline-flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-2xl border text-base font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <Save className="h-4 w-4" /> SALVAR REGRAS
          </button>
        </Section>

        {/* 3. BACKEND DE IA */}
        <Section title="Servidor de IA" icon={<Globe className="h-5 w-5" />}>
          <div className="flex items-center justify-between p-6 bg-secondary/30 rounded-[2rem] border border-border">
            <div className="flex items-center gap-4">
              <div className="bg-secondary border-border flex h-10 w-10 items-center justify-center rounded-2xl border">
                <RefreshCw
                  className={`h-5 w-5 text-primary ${aiStatus === "loading" ? "animate-spin" : ""}`}
                />
              </div>
              <div>
                <p className="t-label text-muted-foreground">STATUS DA CONEXÃO</p>
                <div className="flex items-center gap-1.5">
                  {aiStatus === "connected" ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="t-body text-emerald-700 dark:text-emerald-300">
                        CONECTADO AO RAILWAY
                      </span>
                    </>
                  ) : aiStatus === "disconnected" ? (
                    <>
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                      <span className="t-body text-destructive">DESCONECTADO</span>
                    </>
                  ) : (
                    <span className="t-body text-muted-foreground">VERIFICANDO...</span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={checkHealth}
              className="t-label border-border bg-card hover:bg-secondary focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center rounded-xl border px-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              TESTAR CONEXÃO
            </button>
          </div>
        </Section>

        {/* 4. DADOS E PRIVACIDADE */}
        <Section title="Dados e privacidade" icon={<Shield className="h-5 w-5" />}>
          <div className="space-y-4">
            <div className="p-6 bg-secondary/30 rounded-[2rem] border border-border">
              <h3 className="t-title text-foreground mb-2">EXPORTAÇÃO DE DADOS</h3>
              <p className="text-xs text-muted-foreground font-bold mb-4">
                Baixe uma cópia completa de todos os seus plantões, pacientes, evoluções e
                prescrições em formato JSON.
              </p>
              <button
                onClick={handleExportData}
                className="bg-navy text-navy-foreground focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center rounded-xl px-5 text-base font-bold transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
              >
                EXPORTAR MEUS DADOS
              </button>
            </div>
            <div className="p-6 bg-destructive/5 rounded-[2rem] border border-destructive/20">
              <h3 className="t-title text-destructive mb-2">ENCERRAR SESSÃO</h3>
              <p className="text-xs text-destructive/70 font-bold mb-4">
                Isto irá deslogar do sistema e limpar os dados temporários locais deste dispositivo.
              </p>
              <button
                onClick={handleLogout}
                className="bg-destructive focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center rounded-xl px-5 text-base font-bold text-white transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
              >
                SAIR DA CONTA
              </button>
            </div>
          </div>
        </Section>

        {/* 4. SOBRE O APP */}
        <Section title="Sobre o app" icon={<Info className="h-5 w-5" />}>
          <div className="text-center space-y-4">
            <img
              src="/logo.png"
              alt="Medfluxo"
              className="h-20 w-20 rounded-[2rem] mx-auto shadow-2xl shadow-navy/20"
            />
            <div>
              <h3 className="text-lg font-black text-foreground tracking-tight">
                MEDFLUXO — FASE 2
              </h3>
              <p className="t-body text-muted-foreground">
                ASSISTENTE CLÍNICO INTELIGENTE · VERSÃO 2.0
              </p>
            </div>
            <div className="flex justify-center gap-6 pt-4">
              <a
                href="#"
                className="t-label text-primary focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center rounded-xl px-2 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                TERMOS DE USO
              </a>
              <a
                href="#"
                className="t-label text-primary focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center rounded-xl px-2 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                PRIVACIDADE
              </a>
            </div>
          </div>
        </Section>
      </main>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: any; children: any }) {
  return (
    <section className="bg-card border-border rounded-3xl border p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="bg-secondary text-muted-foreground flex h-10 w-10 items-center justify-center rounded-2xl">
          {icon}
        </div>
        <h2 className="t-title text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

const inputCls =
  "w-full min-h-[3rem] bg-secondary/40 border border-border rounded-xl px-4 py-3 text-base font-medium text-foreground placeholder:font-normal placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card transition-colors uppercase";
