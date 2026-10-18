import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { AuthField, AuthShell, authButtonCls } from "@/components/auth/AuthShell";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  validateSearch: z.object({ redirect: z.string().optional() }),
  head: () => ({ meta: [{ title: "Entrar — MEDFLUXO" }] }),
});

/** Só caminho interno: "//outro.site" e "/\\outro" levariam para fora. */
function destinoSeguro(redirect: string | undefined): string {
  if (
    !redirect ||
    !redirect.startsWith("/") ||
    redirect.startsWith("//") ||
    redirect.startsWith("/\\")
  )
    return "/dashboard";
  return redirect;
}

function LoginPage() {
  const { signIn, configured } = useAuth();
  const { redirect } = Route.useSearch();
  const nav = useNavigate();
  const paraPediatria = redirect?.startsWith("/emergencia-pediatrica") ?? false;
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, senha);
      // href, não to: o destino pode trazer busca (?rcp=1 do atalho do ícone)
      nav({ href: destinoSeguro(redirect), replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao entrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      titulo="Entrar"
      subtitulo={
        paraPediatria
          ? "A emergência pediátrica é só para contas convidadas"
          : "Acesse seus plantões e pacientes"
      }
      rodape={
        <>
          Ainda não tem conta?{" "}
          <Link
            to="/cadastro"
            className="text-primary hover:underline"
            data-testid="auth-go-signup"
          >
            Criar conta
          </Link>
        </>
      }
    >
      {paraPediatria && (
        <p
          className="t-label text-foreground bg-muted mb-4 rounded-xl px-4 py-3"
          data-testid="login-aviso-pediatria"
        >
          Entre uma vez e este aparelho fica liberado por 30 dias, mesmo sem internet.
        </p>
      )}
      {!configured && (
        <p className="mb-4 text-xs font-bold text-warning-foreground bg-warning/15 rounded-xl px-4 py-3">
          Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
        </p>
      )}
      <form onSubmit={submit} className="space-y-4">
        <AuthField
          id="auth-email"
          label="E-mail"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          data-testid="auth-email"
        />
        <AuthField
          id="auth-password"
          label="Senha"
          type="password"
          required
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          data-testid="auth-password"
        />
        <button
          type="submit"
          disabled={loading || !configured}
          className={authButtonCls}
          data-testid="auth-submit"
        >
          {loading && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />} Entrar
        </button>
      </form>
      <div className="mt-4 text-center">
        <Link
          to="/recuperar-senha"
          className="t-label text-muted-foreground hover:text-primary focus-visible:ring-ring inline-flex min-h-[2.75rem] items-center rounded-xl px-2 focus-visible:ring-2 focus-visible:outline-none"
        >
          Esqueci minha senha
        </Link>
      </div>
    </AuthShell>
  );
}
