import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Lock, Stethoscope, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/nova-senha")({
  component: NovaSenhaPage,
  head: () => ({ meta: [{ title: "Nova Senha — DOUTOR AJUDA" }] }),
});

function NovaSenhaPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error("Mínimo 8 caracteres."); return; }
    if (password !== confirm) { toast.error("Senhas não coincidem."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha alterada com sucesso!");
      navigate({ to: "/login" });
    } catch (err: any) { toast.error(err?.message || "Erro ao alterar senha."); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-50" />
      <div className="w-full max-w-md p-8 relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2rem] p-10 shadow-2xl">
          <div className="flex flex-col items-center mb-10">
            <div className="h-16 w-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg mb-6"><Stethoscope className="h-8 w-8 text-white" /></div>
            <h1 className="text-2xl font-black text-white uppercase">NOVA SENHA</h1>
            <p className="text-[10px] font-black tracking-[0.3em] uppercase text-white/50 mt-2">DEFINA SUA NOVA SENHA</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[10px] font-black text-white/60 uppercase tracking-widest mb-2 ml-1">NOVA SENHA *</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30" />
                <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-12 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" placeholder="Mínimo 8 caracteres" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">{showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-white/60 uppercase tracking-widest mb-2 ml-1">CONFIRMAR SENHA *</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/30" />
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all" placeholder="••••••••" />
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-3 py-4 rounded-xl bg-primary text-white font-black uppercase tracking-[0.2em] text-[11px] shadow-xl disabled:opacity-50 transition-all mt-4">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "ALTERAR SENHA"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
