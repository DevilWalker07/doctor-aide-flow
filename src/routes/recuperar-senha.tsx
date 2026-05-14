import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, Stethoscope, ArrowLeft, CheckCircle2 } from "lucide-react";
import { resetPassword } from "@/lib/auth";
import { hasSupabaseConfig } from "@/lib/supabase";

export const Route = createFileRoute("/recuperar-senha")({
  component: RecuperarSenhaPage,
  head: () => ({ meta: [{ title: "Recuperar Senha — DOUTOR AJUDA" }] }),
});

function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasSupabaseConfig) { toast.info("Modo offline"); return; }
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
      toast.success("Link enviado!");
    } catch (err: any) { toast.error(err?.message || "Erro"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-50" />
      <div className="w-full max-w-md p-8 relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2rem] p-10 shadow-2xl">
          <div className="flex flex-col items-center mb-10">
            <div className="h-16 w-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg mb-6"><Stethoscope className="h-8 w-8 text-white" /></div>
            <h1 className="text-2xl font-black text-white uppercase">RECUPERAR SENHA</h1>
            <p className="text-[10px] font-black tracking-[0.3em] uppercase text-white/50 mt-2">DOUTOR AJUDA</p>
          </div>
          {sent ? (
            <div className="text-center space-y-6 py-8">
              <CheckCircle2 className="h-16 w-16 text-emerald-400 mx-auto" />
              <p className="text-white font-bold text-sm">LINK ENVIADO!</p>
              <p className="text-[11px] text-white/50">Verifique <span className="text-white font-bold">{email}</span></p>
              <Link to="/login" className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-white/10 text-white text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all"><ArrowLeft className="h-4 w-4" /> VOLTAR</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-[11px] text-white/50 text-center mb-6">Informe seu e-mail e enviaremos um link de recuperação.</p>
              <div>
                <label className="block text-[10px] font-black text-white/60 uppercase tracking-widest mb-2 ml-1">E-MAIL *</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30" />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" placeholder="dr.exemplo@hospital.com" />
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-3 py-4 rounded-xl bg-primary text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-xl disabled:opacity-50 transition-all">
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "ENVIAR LINK"}
              </button>
              <div className="text-center pt-4"><Link to="/login" className="text-[10px] font-black text-white/40 hover:text-white uppercase tracking-widest flex items-center justify-center gap-2"><ArrowLeft className="h-3 w-3" /> VOLTAR</Link></div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
