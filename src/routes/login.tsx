import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase, hasSupabaseConfig } from "@/lib/supabase";
import { toast } from "sonner";
import { Loader2, Lock, Mail, Stethoscope } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: Login,
  head: () => ({ meta: [{ title: "Doutor Ajuda — Entrar no Plantão" }] }),
});

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Se já estiver logado, redireciona
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate({ to: "/" });
    });
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasSupabaseConfig) {
      toast.error("Supabase não configurado. Continuando no modo local offline.");
      navigate({ to: "/" });
      return;
    }

    setLoading(true);
    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      if (isSignUp) {
        toast.success("Conta criada! Você já pode entrar.");
        setIsSignUp(false);
      } else {
        toast.success("Bem-vindo(a) ao Doutor Ajuda!");
        navigate({ to: "/" });
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy text-navy-foreground relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-50" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-ai/20 rounded-full blur-3xl opacity-50" />

      <div className="w-full max-w-md p-8 relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2rem] p-8 shadow-2xl shadow-black/50">
          <div className="flex flex-col items-center justify-center mb-10">
            <div className="h-16 w-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 mb-6">
              <Stethoscope className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">DOUTOR AJUDA</h1>
            <p className="text-[11px] font-bold tracking-widest uppercase text-white/60">AUTENTICAÇÃO MÉDICA</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            <div>
              <label className="block text-[11px] font-bold text-white/70 uppercase tracking-widest mb-2 ml-1">E-MAIL PROFISSIONAL</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                  placeholder="dr.exemplo@hospital.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-white/70 uppercase tracking-widest mb-2 ml-1">SENHA</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center py-4 rounded-xl bg-primary text-primary-foreground font-bold uppercase tracking-widest shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all mt-8"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (isSignUp ? "CADASTRAR E ENTRAR" : "INICIAR SESSÃO")}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-[11px] font-bold tracking-widest uppercase text-white/60 hover:text-white transition-colors"
            >
              {isSignUp ? "JÁ TEM CONTA? FAÇA LOGIN" : "NOVO POR AQUI? CRIE UMA CONTA"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
