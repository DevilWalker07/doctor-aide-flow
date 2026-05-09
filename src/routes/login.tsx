import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Stethoscope } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Login — DOUTOR AJUDA" }] }),
});

function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function signIn() {
    if (!email || !password) return toast.error("Informe e-mail e senha");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Login realizado");
    nav({ to: "/tipo" });
  }

  async function signUp() {
    if (!email || !password) return toast.error("Informe e-mail e senha");
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Conta criada. Confira seu e-mail se a confirmação estiver ativa.");
    nav({ to: "/tipo" });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-11 w-11 rounded-xl bg-navy text-navy-foreground grid place-items-center">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-extrabold tracking-tight">DOUTOR AJUDA</h1>
            <p className="label-tech text-[10px]">LOGIN DO MÉDICO</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label-tech block mb-1.5">E-MAIL</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="w-full bg-input-bg border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="label-tech block mb-1.5">SENHA</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="w-full bg-input-bg border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <button disabled={loading} onClick={signIn} className="w-full py-3 rounded-xl bg-navy text-navy-foreground font-bold uppercase tracking-wide hover:opacity-90 disabled:opacity-60">
            {loading ? "ENTRANDO..." : "ENTRAR"}
          </button>
          <button disabled={loading} onClick={signUp} className="w-full py-3 rounded-xl border border-border font-bold uppercase tracking-wide hover:bg-secondary disabled:opacity-60">
            CRIAR CONTA
          </button>
        </div>

        <p className="text-[11px] text-muted-foreground mt-6 leading-relaxed">
          Dados clínicos protegidos por autenticação e Row Level Security no Supabase. Documentos gerados por IA exigem revisão médica obrigatória.
        </p>
      </div>
    </div>
  );
}
