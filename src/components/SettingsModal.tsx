import { useState, useEffect } from "react";
import { X, Shield, Sparkles, Key, Zap } from "lucide-react";
import { toast } from "sonner";

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [engine, setEngine] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    if (open) {
      setEngine(localStorage.getItem("ai_engine") || "openai");
      setApiKey(localStorage.getItem("ai_api_key") || "");
      setUserName(localStorage.getItem("user_doctor_name") || "");
    }
  }, [open]);

  const save = () => {
    localStorage.setItem("ai_engine", engine);
    localStorage.setItem("ai_api_key", apiKey);
    localStorage.setItem("user_doctor_name", userName);
    toast.success("Configurações salvas com sucesso!");
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#0F172A]/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
        <header className="px-8 py-6 border-b border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#2563EB]/10 flex items-center justify-center text-[#2563EB]">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-[#0F172A] uppercase">Configurações</h2>
              <p className="text-[9px] font-black uppercase tracking-widest text-[#64748B] mt-0.5">Sistema & Inteligência Artificial</p>
            </div>
          </div>
          <button onClick={onClose} className="h-10 w-10 rounded-full hover:bg-[#F1F5F9] flex items-center justify-center transition-colors">
            <X className="h-5 w-5 text-[#64748B]" />
          </button>
        </header>

        <div className="p-8 space-y-6">
          <div className="space-y-4">
            <label className="text-[10px] font-black text-[#0F172A] uppercase tracking-[0.2em] block ml-1">Motor de IA</label>
            <div className="grid grid-cols-2 gap-3 p-1 bg-[#F1F5F9] rounded-2xl">
              <button 
                onClick={() => setEngine("openai")}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${engine === "openai" ? "bg-white text-[#2563EB] shadow-md" : "text-[#64748B] hover:text-[#0F172A]"}`}
              >
                <Sparkles className="h-4 w-4" /> OpenAI
              </button>
              <button 
                onClick={() => setEngine("groq")}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${engine === "groq" ? "bg-white text-[#7C3AED] shadow-md" : "text-[#64748B] hover:text-[#0F172A]"}`}
              >
                <Zap className="h-4 w-4" /> Groq
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-[#0F172A] uppercase tracking-[0.2em] block ml-1">Chave de API</label>
            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#CBD5E1]" />
              <input 
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-2xl pl-12 pr-4 py-4 text-xs font-bold focus:outline-none focus:border-[#2563EB] transition-all"
              />
            </div>
            <p className="text-[9px] text-[#64748B] font-bold uppercase leading-relaxed px-1">
              Sua chave é salva apenas localmente no seu navegador e nunca enviada para nossos servidores.
            </p>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-[#0F172A] uppercase tracking-[0.2em] block ml-1">Nome do Médico (Assinatura)</label>
            <input 
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="DR. LUAN CARVALHO"
              className="w-full bg-[#F8FAFC] border-2 border-[#E2E8F0] rounded-2xl px-5 py-4 text-xs font-bold uppercase focus:outline-none focus:border-[#2563EB] transition-all"
            />
          </div>
        </div>

        <footer className="px-8 py-6 bg-[#F8FAFC] border-t border-[#E2E8F0] flex gap-3">
          <button onClick={onClose} className="flex-1 py-4 rounded-2xl border-2 border-[#E2E8F0] text-[10px] font-black uppercase tracking-widest text-[#0F172A] hover:bg-white transition-all">Cancelar</button>
          <button onClick={save} className="flex-1 py-4 rounded-2xl bg-[#2563EB] text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40 transition-all">Salvar Alterações</button>
        </footer>
      </div>
    </div>
  );
}
