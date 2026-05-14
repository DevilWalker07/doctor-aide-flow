import { useEffect, useState } from "react";
import { Server, Shield, X, Zap } from "lucide-react";
import { toast } from "sonner";

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [engine, setEngine] = useState("backend");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    if (open) {
      setEngine(localStorage.getItem("ai_engine") || "backend");
      setUserName(localStorage.getItem("user_doctor_name") || "");
    }
  }, [open]);

  const save = () => {
    localStorage.setItem("ai_engine", engine);
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
              <p className="text-[9px] font-black uppercase tracking-widest text-[#64748B] mt-0.5">Sistema e IA segura</p>
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
                onClick={() => setEngine("backend")}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${engine === "backend" ? "bg-white text-[#2563EB] shadow-md" : "text-[#64748B] hover:text-[#0F172A]"}`}
              >
                <Server className="h-4 w-4" /> Backend
              </button>
              <button
                onClick={() => setEngine("mock")}
                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${engine === "mock" ? "bg-white text-[#7C3AED] shadow-md" : "text-[#64748B] hover:text-[#0F172A]"}`}
              >
                <Zap className="h-4 w-4" /> Mock
              </button>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border-2 border-[#E2E8F0] bg-[#F8FAFC] p-5">
            <label className="text-[10px] font-black text-[#0F172A] uppercase tracking-[0.2em] block">Chaves de IA</label>
            <p className="text-[10px] text-[#64748B] font-bold uppercase leading-relaxed">
              O frontend não guarda nem chama chaves reais. Configure OpenAI apenas no backend local usando <code>server/.env</code>. Se o backend estiver offline, o app usa mocks.
            </p>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-[#0F172A] uppercase tracking-[0.2em] block ml-1">Nome do médico (assinatura)</label>
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
          <button onClick={save} className="flex-1 py-4 rounded-2xl bg-[#2563EB] text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40 transition-all">Salvar</button>
        </footer>
      </div>
    </div>
  );
}
