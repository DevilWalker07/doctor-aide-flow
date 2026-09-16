import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AuthField, AuthShell, authButtonCls } from "@/components/auth/AuthShell";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/nova-senha")({
  component: NovaSenhaPage,
  head: () => ({ meta: [{ title: "Nova senha — MEDFLUXO" }] }),
});

function NovaSenhaPage() {
  const { updatePassword, session, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (senha.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirma) {
      toast.error("As senhas não conferem.");
      return;
    }
    setLoading(true);
    try {
      await updatePassword(senha);
      toast.success("Senha atualizada.");
      nav({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar a senha.");
    } finally {
      setLoading(false);
    }
  };

  const semSessao = !authLoading && !session;

  return (
    <AuthShell
      titulo="Nova senha"
      subtitulo="Defina uma nova senha para sua conta"
      rodape={
        <Link to="/login" className="text-primary hover:underline">
          Voltar ao login
        </Link>
      }
    >
      {semSessao ? (
        <p className="text-sm font-semibold text-foreground">
          Abra esta página pelo link enviado ao seu e-mail para redefinir a senha.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <AuthField
            id="auth-password"
            label="Nova senha (mínimo 8 caracteres)"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            data-testid="auth-password"
          />
          <AuthField
            id="auth-password-confirm"
            label="Repita a nova senha"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirma}
            onChange={(e) => setConfirma(e.target.value)}
            data-testid="auth-password-confirm"
          />
          <button
            type="submit"
            disabled={loading || authLoading}
            className={authButtonCls}
            data-testid="auth-submit"
          >
            {loading && <Loader2 className="h-3 w-3 animate-spin" />} Salvar nova senha
          </button>
        </form>
      )}
    </AuthShell>
  );
}
