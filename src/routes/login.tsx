import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Lock, Mail, Stethoscope, Eye, EyeOff } from "lucide-react";
import { signIn } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/supabase";

const TEST_LOGIN_EMAIL = import.meta.env.VITE_TEST_LOGIN_EMAIL || "test@doutorajuda.local";
const TEST_LOGIN_PASSWORD = import.meta.env.VITE_TEST_LOGIN_PASSWORD || "";
const TEST_LOGIN_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_TEST_LOGIN === "true";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Entrar — DOUTOR AJUDA" }] }),
});

function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const loggedEmailTyping = useRef(false);
  const loggedPasswordTyping = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    setHydrated(true);
  }, []);

  const handleEmailFocus = useCallback(() => {
    if (import.meta.env.DEV && !loggedEmailTyping.current) {
      console.debug("[AUTH] typing email");
      loggedEmailTyping.current = true;
    }
  }, []);

  const handlePasswordFocus = useCallback(() => {
    if (import.meta.env.DEV && !loggedPasswordTyping.current) {
      console.debug("[AUTH] typing password");
      loggedPasswordTyping.current = true;
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (import.meta.env.DEV) console.debug("[AUTH] submit login");
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");

    if (!hasSupabaseConfig) {
      toast.info("Modo offline — Supabase não configurado.");
      navigate({ to: "/" });
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      toast.success("Bem-vindo(a) ao Doutor Ajuda!");
      navigate({ to: "/" });
    } catch (error: any) {
      const msg = error?.message || "";
      if (msg.includes("Invalid login")) {
        toast.error("E-mail ou senha incorretos.");
      } else if (msg.includes("Email not confirmed")) {
        toast.error("Verifique sua caixa de entrada para confirmar o e-mail.");
      } else {
        toast.error(msg || "Erro ao fazer login.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTestLogin = async () => {
    if (import.meta.env.DEV) console.debug("[AUTH] submit login");

    if (!hasSupabaseConfig) {
      toast.info("Modo offline - Supabase nao configurado.");
      navigate({ to: "/" });
      return;
    }

    if (!TEST_LOGIN_PASSWORD) {
      toast.error("Defina VITE_TEST_LOGIN_PASSWORD para usar o login de teste.");
      return;
    }

    setLoading(true);
    try {
      await signIn(TEST_LOGIN_EMAIL, TEST_LOGIN_PASSWORD);
      toast.success("Entrando com usuario de teste.");
      navigate({ to: "/" });
    } catch (error: any) {
      toast.error(error?.message || "Erro ao entrar com usuario de teste.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy text-navy-foreground px-6 py-10">
      <div className="w-full max-w-md">
        <div className="bg-white/10 border border-white/20 rounded-2xl p-8 shadow-xl shadow-black/30">
          <div className="flex flex-col items-center justify-center mb-10">
            <div className="h-16 w-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 mb-6">
              <Stethoscope className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white mb-2 uppercase">DOUTOR AJUDA</h1>
            <p className="text-[10px] font-black tracking-[0.3em] uppercase text-white/50">BEM-VINDO DE VOLTA</p>
          </div>

          {!hydrated ? (
            <div className="py-10 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-white/60" />
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[10px] font-black text-white/60 uppercase tracking-widest mb-2 ml-1">E-MAIL *</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30" />
                <input
                  type="email"
                  name="email"
                  onFocus={handleEmailFocus}
                  autoComplete="email"
                  inputMode="email"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all text-sm"
                  placeholder="dr.exemplo@hospital.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-white/60 uppercase tracking-widest mb-2 ml-1">SENHA *</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  onFocus={handlePasswordFocus}
                  autoComplete="current-password"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-12 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all text-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-xl bg-primary text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all mt-8 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "ENTRAR"}
            </button>

            {TEST_LOGIN_ENABLED && (
              <button
                type="button"
                onClick={handleTestLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-white/15 bg-white/5 text-white/80 font-black uppercase tracking-[0.18em] text-[10px] hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                Entrar como usuario de teste
              </button>
            )}
          </form>
          )}

          <div className="mt-8 space-y-3 text-center">
            <Link
              to="/cadastro"
              className="block text-[10px] font-black tracking-widest uppercase text-white/50 hover:text-white transition-colors"
            >
              NÃO TEM CONTA? <span className="text-primary">CRIAR CONTA</span>
            </Link>
            <Link
              to="/recuperar-senha"
              className="block text-[10px] font-bold tracking-widest uppercase text-white/30 hover:text-white/60 transition-colors"
            >
              ESQUECI MINHA SENHA
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
