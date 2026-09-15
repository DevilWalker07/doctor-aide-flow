import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { AuthShell, authButtonCls, authInputCls } from "@/components/auth/AuthShell";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({ meta: [{ title: "Entrar — DOUTOR AJUDA" }] }),
});

function LoginPage() {
  const { signIn, configured } = useAuth();
  const { redirect } = Route.useSearch();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, senha);
      nav({ to: redirect && redirect.startsWith("/") ? redirect : "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao entrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      titulo="Entrar"
      subtitulo="Acesse seus plantões e pacientes"
      rodape={
        <>
          Ainda não tem conta?{" "}
          <Link to="/cadastro" className="text-primary hover:underline" data-testid="auth-go-signup">
            Criar conta
          </Link>
        </>
      }
    >
      {!configured && <p className="mb-4 text-xs font-bold text-warning-foreground bg-warning/15 rounded-xl px-4 py-3">Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).</p>}
      <form onSubmit={submit} className="space-y-3">
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" className={authInputCls} data-testid="auth-email" />
        <input type="password" required autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha" className={authInputCls} data-testid="auth-password" />
        <button type="submit" disabled={loading || !configured} className={authButtonCls} data-testid="auth-submit">
          {loading && <Loader2 className="h-3 w-3 animate-spin" />} Entrar
        </button>
      </form>
      <div className="mt-4 text-center">
        <Link to="/recuperar-senha" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary">
          Esqueci minha senha
        </Link>
      </div>
    </AuthShell>
  );
}
