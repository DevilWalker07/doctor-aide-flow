import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AuthShell, authButtonCls, authInputCls } from "@/components/auth/AuthShell";
import { useAuth } from "@/hooks/useAuth";
import { storage } from "@/lib/storage";

export const Route = createFileRoute("/cadastro")({
  component: CadastroPage,
  head: () => ({ meta: [{ title: "Criar conta — DOUTOR AJUDA" }] }),
});

function CadastroPage() {
  const { signUp, configured } = useAuth();
  const nav = useNavigate();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [loading, setLoading] = useState(false);
  const [aguardandoConfirmacao, setAguardandoConfirmacao] = useState(false);

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
      const { needsConfirmation } = await signUp(email, senha, nome);
      storage.setNomeMedico(nome.trim().toUpperCase());
      if (needsConfirmation) {
        setAguardandoConfirmacao(true);
      } else {
        toast.success("Conta criada!");
        nav({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar conta.");
    } finally {
      setLoading(false);
    }
  };

  if (aguardandoConfirmacao) {
    return (
      <AuthShell titulo="Confirme seu e-mail" subtitulo="Enviamos um link de confirmação">
        <p className="text-sm font-semibold text-foreground">
          Abra o e-mail enviado para <strong>{email}</strong> e clique no link para ativar a conta. Depois volte e entre.
        </p>
        <Link to="/login" className={`${authButtonCls} mt-6`}>
          Ir para o login
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      titulo="Criar conta"
      subtitulo="Seus dados ficam isolados por usuário"
      rodape={
        <>
          Já tem conta?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <input required autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" className={authInputCls} data-testid="auth-name" />
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" className={authInputCls} data-testid="auth-email" />
        <input type="password" required minLength={8} autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha (mín. 8 caracteres)" className={authInputCls} data-testid="auth-password" />
        <input type="password" required minLength={8} autoComplete="new-password" value={confirma} onChange={(e) => setConfirma(e.target.value)} placeholder="Confirmar senha" className={authInputCls} data-testid="auth-password-confirm" />
        <button type="submit" disabled={loading || !configured} className={authButtonCls} data-testid="auth-submit">
          {loading && <Loader2 className="h-3 w-3 animate-spin" />} Criar conta
        </button>
      </form>
    </AuthShell>
  );
}
