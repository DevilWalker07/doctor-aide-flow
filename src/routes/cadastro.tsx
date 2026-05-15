import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, User, Mail, Lock, Stethoscope, Eye, EyeOff, ShieldCheck } from "lucide-react";
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
  const [hydrated, setHydrated] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmationPending, setConfirmationPending] = useState(false);
  const loggedEmailTyping = useRef(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const validate = (form: Record<string, string>): boolean => {
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
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const form = {
      name: String(formData.get("name") || ""),
      email: String(formData.get("email") || ""),
      password: String(formData.get("password") || ""),
      confirmPassword: String(formData.get("confirmPassword") || ""),
      crm: String(formData.get("crm") || ""),
      specialty: String(formData.get("specialty") || ""),
    };
    if (!validate(form)) return;

    if (!hasSupabaseConfig) {
      toast.info("Modo offline — Supabase não configurado.");
      navigate({ to: "/login" });
      return;
    }

    setLoading(true);
    try {
      const data = await signUp(
        form.email,
        form.password,
        form.name.toUpperCase(),
        form.crm.toUpperCase(),
        form.specialty.toUpperCase()
      );
      if (data.session) {
        toast.success("Conta criada!");
        navigate({ to: "/" });
        return;
      }
      setConfirmationPending(true);
    } catch (error: any) {
      toast.error(error?.message || "Erro ao criar conta.");
    } finally {
      setLoading(false);
    }
  };

  const handleFieldFocus = useCallback((key: string) => {
    if (import.meta.env.DEV && key === "email" && !loggedEmailTyping.current) {
      console.debug("[AUTH] typing email");
      loggedEmailTyping.current = true;
    }
  }, []);

  const resendEmail = () => {
    toast.info("Use o link enviado pelo Supabase para confirmar seu e-mail.");
  };

  if (confirmationPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy text-navy-foreground px-6 py-10">
        <div className="w-full max-w-md">
          <div className="bg-white/10 border border-white/20 rounded-2xl p-8 shadow-xl shadow-black/30 text-center">
            <div className="h-16 w-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 mx-auto mb-6">
              <Mail className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white mb-3 uppercase">Cadastro criado</h1>
            <p className="text-sm leading-6 text-white/70">Confirme seu e-mail para entrar.</p>
            <div className="mt-8 space-y-3">
              <button
                type="button"
                onClick={resendEmail}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-xl bg-primary text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-xl shadow-primary/20 hover:shadow-primary/40 transition-colors"
              >
                Reenviar e-mail
              </button>
              <button
                type="button"
                onClick={() => navigate({ to: "/login" })}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/15 bg-white/5 text-white/80 font-black uppercase tracking-[0.18em] text-[10px] hover:bg-white/10 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Ir para login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy text-navy-foreground px-6 py-10">
      <div className="w-full max-w-md">
        <div className="bg-white/10 border border-white/20 rounded-2xl p-8 shadow-xl shadow-black/30">
          <div className="flex flex-col items-center justify-center mb-10">
            <div className="h-16 w-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 mb-6">
              <ShieldCheck className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white mb-2 uppercase">CRIAR CONTA</h1>
            <p className="text-[10px] font-black tracking-[0.3em] uppercase text-white/50">DOUTOR AJUDA · CADASTRO MÉDICO</p>
          </div>

          {!hydrated ? (
            <div className="py-10 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-white/60" />
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field
              label="NOME COMPLETO *"
              icon={<User className="h-4 w-4" />}
              name="name"
              onFocus={() => handleFieldFocus("name")}
              error={errors.name}
              placeholder="DR(A). NOME COMPLETO"
            />
            <Field
              label="E-MAIL *"
              icon={<Mail className="h-4 w-4" />}
              name="email"
              onFocus={() => handleFieldFocus("email")}
              error={errors.email}
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="dr.exemplo@hospital.com"
            />
            <div className="relative">
              <Field
                label="SENHA * (MÍNIMO 8 CARACTERES)"
                icon={<Lock className="h-4 w-4" />}
                name="password"
                onFocus={() => handleFieldFocus("password")}
                error={errors.password}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
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
              name="confirmPassword"
              onFocus={() => handleFieldFocus("confirmPassword")}
              error={errors.confirmPassword}
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
            />

            <div className="border-t border-white/10 pt-4 mt-2" />

            <Field
              label="CRM (OPCIONAL)"
              icon={<Stethoscope className="h-4 w-4" />}
              name="crm"
              onFocus={() => handleFieldFocus("crm")}
              placeholder="EX: 123456-SP"
            />
            <Field
              label="ESPECIALIDADE (OPCIONAL)"
              icon={<Stethoscope className="h-4 w-4" />}
              name="specialty"
              onFocus={() => handleFieldFocus("specialty")}
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
          )}

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

const Field = memo(function Field({
  label, icon, name, onFocus, error, type = "text", placeholder,
  autoComplete, inputMode,
}: {
  label: string; icon: React.ReactNode; name: string;
  onFocus: () => void; error?: string;
  type?: string; placeholder?: string;
  autoComplete?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div>
      <label className="block text-[9px] font-black text-white/50 uppercase tracking-widest mb-1.5 ml-1">{label}</label>
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/25">{icon}</div>
        <input
          type={type}
          name={name}
          onFocus={onFocus}
          autoComplete={autoComplete}
          inputMode={inputMode}
          className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
          placeholder={placeholder}
        />
      </div>
      {error && <p className="text-[10px] font-bold text-red-400 mt-1 ml-1">{error}</p>}
    </div>
  );
});
