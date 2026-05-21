import { createFileRoute, useNavigate, Link, Navigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Stethoscope, Loader2, Mail, Lock, User, AlertCircle } from "lucide-react";
import { signUpWithEmail, signInWithGoogle, type AuthError } from "@/lib/auth";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import ThemeToggle from "@/components/ThemeToggle";

export const Route = createFileRoute("/cadastro")({
  component: CadastroPage,
  head: () => ({ meta: [{ title: "Criar conta — Doutor Ajuda" }] }),
});

function CadastroPage() {
  const nav = useNavigate();
  const { isAuthenticated, isLoaded } = useSupabaseUser();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && isAuthenticated) {
      nav({ to: "/", replace: true });
    }
  }, [isLoaded, isAuthenticated, nav]);

  if (isLoaded && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !email.trim() || password.length < 6) return;
    setError(null);
    setLoading(true);
    try {
      await signUpWithEmail(email, password, name);
      // Login imediato (sem confirmação de email) — sessão criada, redireciona
      nav({ to: "/", replace: true });
    } catch (err) {
      setError((err as AuthError).message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (googleLoading) return;
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError((err as AuthError).message);
      setGoogleLoading(false);
    }
  };

  const senhaInvalida = password.length > 0 && password.length < 6;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="px-4 py-4 flex items-center justify-end">
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-3">
            <div className="h-14 w-14 rounded-2xl bg-navy text-white inline-flex items-center justify-center shadow-lg shadow-navy/20 mx-auto">
              <Stethoscope className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Criar conta</h1>
              <p className="text-[13px] text-muted-foreground mt-1">Seus pacientes ficam isolados na sua conta</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading || loading}
            className="w-full h-11 rounded-md border border-border bg-elevated text-sm font-medium inline-flex items-center justify-center gap-2.5 hover:bg-subtle transition-colors disabled:opacity-50"
          >
            {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleLogo />}
            Continuar com Google
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] text-muted-foreground uppercase tracking-widest">ou</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="name" className="text-[12px] font-medium block mb-1.5">Nome (como aparece na assinatura)</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 pl-9 pr-3 rounded-md border border-input bg-elevated text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Dr. Luan Carvalho"
                />
              </div>
            </div>
            <div>
              <label htmlFor="email" className="text-[12px] font-medium block mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 pl-9 pr-3 rounded-md border border-input bg-elevated text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="seu@email.com"
                />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="text-[12px] font-medium block mb-1.5">Senha (mínimo 6 caracteres)</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full h-11 pl-9 pr-3 rounded-md border bg-elevated text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring ${
                    senhaInvalida ? "border-destructive/50" : "border-input"
                  }`}
                  placeholder="••••••••"
                />
              </div>
              {senhaInvalida && (
                <p className="text-[11px] text-destructive mt-1">Pelo menos 6 caracteres.</p>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p className="text-[13px]">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || googleLoading || !email.trim() || password.length < 6}
              className="w-full h-11 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Criando…" : "Criar conta"}
            </button>
          </form>

          <p className="text-center text-[13px] text-muted-foreground">
            Já tem conta?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 18 18" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  );
}
