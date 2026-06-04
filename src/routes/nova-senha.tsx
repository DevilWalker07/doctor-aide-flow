import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Stethoscope, Loader2, Mail, Lock, AlertCircle, CheckCircle2 } from "lucide-react";
import { sendPasswordReset, updatePassword, type AuthError } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import ThemeToggle from "@/components/ThemeToggle";

export const Route = createFileRoute("/nova-senha")({
  component: NovaSenhaPage,
  head: () => ({ meta: [{ title: "Nova senha — Doutor Ajuda" }] }),
});

function NovaSenhaPage() {
  const nav = useNavigate();
  // 2 modos: solicitar reset OU definir nova senha (vindo do link de email)
  const [mode, setMode] = useState<"request" | "reset">("request");

  useEffect(() => {
    // Se o usuário chegou aqui via link de reset, Supabase coloca a sessão
    // de recovery. Detectar isso e mostrar formulário de nova senha.
    supabase.auth.getSession().then(({ data }) => {
      // Se há sessão E o evento foi PASSWORD_RECOVERY, mostrar form de nova senha
      if (data.session) setMode("reset");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("reset");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

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
            <h1 className="text-2xl font-bold tracking-tight">
              {mode === "request" ? "Esqueceu a senha?" : "Definir nova senha"}
            </h1>
            <p className="text-[13px] text-muted-foreground">
              {mode === "request"
                ? "Vamos te mandar um link por email pra criar uma nova senha."
                : "Escolha uma senha nova pra sua conta."}
            </p>
          </div>

          {mode === "request" ? (
            <RequestForm />
          ) : (
            <ResetForm onDone={() => nav({ to: "/", replace: true })} />
          )}

          <p className="text-center text-[13px] text-muted-foreground">
            <Link to="/login" className="text-primary font-medium hover:underline">
              Voltar pro login
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

function RequestForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !email.trim()) return;
    setError(null);
    setLoading(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError((err as AuthError).message);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex items-start gap-2 p-4 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 dark:text-emerald-400">
        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <p className="text-[13px] font-medium">Email enviado!</p>
          <p className="text-[12px] mt-0.5 opacity-90">Verifique sua caixa de entrada (e o spam) e clique no link pra criar a nova senha.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="email" className="text-[12px] font-medium block mb-1.5">Email da conta</label>
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
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="text-[13px]">{error}</p>
        </div>
      )}
      <button
        type="submit"
        disabled={loading || !email.trim()}
        className="w-full h-11 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center justify-center gap-2"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Enviando…" : "Enviar link"}
      </button>
    </form>
  );
}

function ResetForm({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const senhaInvalida = password.length > 0 && password.length < 6;
  const noMatch = confirm.length > 0 && confirm !== password;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || password.length < 6 || password !== confirm) return;
    setError(null);
    setLoading(true);
    try {
      await updatePassword(password);
      onDone();
    } catch (err) {
      setError((err as AuthError).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="password" className="text-[12px] font-medium block mb-1.5">Nova senha (mínimo 6 caracteres)</label>
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
      </div>
      <div>
        <label htmlFor="confirm" className="text-[12px] font-medium block mb-1.5">Confirmar senha</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={`w-full h-11 pl-9 pr-3 rounded-md border bg-elevated text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring ${
              noMatch ? "border-destructive/50" : "border-input"
            }`}
            placeholder="••••••••"
          />
        </div>
        {noMatch && <p className="text-[11px] text-destructive mt-1">As senhas não batem.</p>}
      </div>
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="text-[13px]">{error}</p>
        </div>
      )}
      <button
        type="submit"
        disabled={loading || password.length < 6 || password !== confirm}
        className="w-full h-11 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center justify-center gap-2"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Salvando…" : "Salvar nova senha"}
      </button>
    </form>
  );
}
