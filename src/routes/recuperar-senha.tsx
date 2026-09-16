import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AuthShell, authButtonCls, authInputCls } from "@/components/auth/AuthShell";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/recuperar-senha")({
  component: RecuperarSenhaPage,
  head: () => ({ meta: [{ title: "Recuperar senha — MEDFLUXO" }] }),
});

function RecuperarSenhaPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await resetPassword(email);
      setEnviado(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar o e-mail.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      titulo="Recuperar senha"
      subtitulo="Enviaremos um link para redefinir"
      rodape={
        <Link to="/login" className="text-primary hover:underline">
          Voltar ao login
        </Link>
      }
    >
      {enviado ? (
        <p className="text-sm font-semibold text-foreground">
          Se existir uma conta para <strong>{email}</strong>, você receberá um e-mail com o link para criar uma nova senha.
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail da conta" className={authInputCls} data-testid="auth-email" />
          <button type="submit" disabled={loading} className={authButtonCls} data-testid="auth-submit">
            {loading && <Loader2 className="h-3 w-3 animate-spin" />} Enviar link
          </button>
        </form>
      )}
    </AuthShell>
  );
}
