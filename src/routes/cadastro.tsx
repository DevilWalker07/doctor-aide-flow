import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, User, Mail, Lock, Stethoscope, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { signUp } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/supabase";

export const Route = createFileRoute("/cadastro")({
  component: CadastroPage,
  head: () => ({ meta: [{ title: "Criar Conta — DOUTOR AJUDA" }] }),
});

function CadastroPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    crm: "",
    specialty: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Nome é obrigatório.";
    if (!form.email.trim()) e.email = "E-mail é obrigatório.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "E-mail inválido.";
    if (!form.password) e.password = "Senha é obrigatória.";
    else if (form.password.length < 8) e.password = "Mínimo de 8 caracteres.";
    if (form.password !== form.confirmPassword) e.confirmPassword = "As senhas não coincidem.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (!hasSupabaseConfig) {
      toast.info("Modo offline — Supabase não configurado.");
      navigate({ to: "/login" });
      return;
    }

    setLoading(true);
    try {
      await signUp(form.email, form.password, form.name, form.crm, form.specialty);
      toast.success("Conta criada! Verifique seu e-mail para confirmar.");
      navigate({ to: "/login" });
    } catch (error: any) {
      toast.error(error?.message || "Erro ao criar conta.");
    } finally {
      setLoading(false);
    }
  };

  const set = (key: string, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy text-navy-foreground relative overflow-hidden py-12">
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-50" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-ai/20 rounded-full blur-3xl opacity-50" />

      <div className="w-full max-w-md px-8 relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2rem] p-10 shadow-2xl shadow-black/50">
          <div className="flex flex-col items-center justify-center mb-10">
            <div className="h-16 w-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 mb-6">
              <ShieldCheck className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white mb-2 uppercase">CRIAR CONTA</h1>
            <p className="text-[10px] font-black tracking-[0.3em] uppercase text-white/50">DOUTOR AJUDA · CADASTRO MÉDICO</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field
              label="NOME COMPLETO *"
              icon={<User className="h-4 w-4" />}
              value={form.name}
              onChange={(v) => set("name", v.toUpperCase())}
              error={errors.name}
              placeholder="DR(A). NOME COMPLETO"
            />
            <Field
              label="E-MAIL *"
              icon={<Mail className="h-4 w-4" />}
              value={form.email}
              onChange={(v) => set("email", v)}
              error={errors.email}
              type="email"
              placeholder="dr.exemplo@hospital.com"
            />
            <div className="relative">
              <Field
                label="SENHA * (MÍNIMO 8 CARACTERES)"
                icon={<Lock className="h-4 w-4" />}
                value={form.password}
                onChange={(v) => set("password", v)}
                error={errors.password}
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-[38px] text-white/30 hover:text-white/60 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Field
              label="CONFIRMAR SENHA *"
              icon={<Lock className="h-4 w-4" />}
              value={form.confirmPassword}
              onChange={(v) => set("confirmPassword", v)}
              error={errors.confirmPassword}
              type="password"
              placeholder="••••••••"
            />

            <div className="border-t border-white/10 pt-4 mt-2" />

            <Field
              label="CRM (OPCIONAL)"
              icon={<Stethoscope className="h-4 w-4" />}
              value={form.crm}
              onChange={(v) => set("crm", v.toUpperCase())}
              placeholder="EX: 123456-SP"
            />
            <Field
              label="ESPECIALIDADE (OPCIONAL)"
              icon={<Stethoscope className="h-4 w-4" />}
              value={form.specialty}
              onChange={(v) => set("specialty", v.toUpperCase())}
              placeholder="EX: CLÍNICA MÉDICA"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-xl bg-primary text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all mt-6 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "CRIAR CONTA"}
            </button>
          </form>

          <div className="mt-8 text-center">
            <Link
              to="/login"
              className="text-[10px] font-black tracking-widest uppercase text-white/50 hover:text-white transition-colors"
            >
              JÁ TEM CONTA? <span className="text-primary">FAZER LOGIN</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, icon, value, onChange, error, type = "text", placeholder,
}: {
  label: string; icon: React.ReactNode; value: string;
  onChange: (v: string) => void; error?: string;
  type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[9px] font-black text-white/50 uppercase tracking-widest mb-1.5 ml-1">{label}</label>
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25">{icon}</div>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
          placeholder={placeholder}
        />
      </div>
      {error && <p className="text-[10px] font-bold text-red-400 mt-1 ml-1">{error}</p>}
    </div>
  );
}
