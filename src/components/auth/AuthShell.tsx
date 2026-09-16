import { Stethoscope } from "lucide-react";
import type { ReactNode } from "react";

export function AuthShell({ titulo, subtitulo, children, rodape }: { titulo: string; subtitulo: string; children: ReactNode; rodape?: ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <Stethoscope className="h-6 w-6" />
          </div>
          <div>
            <div className="text-lg font-black tracking-tight uppercase text-foreground">Medfluxo</div>
            <div className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">HNAS Assist</div>
          </div>
        </div>
        <div className="bg-white border border-border rounded-[2rem] p-8 shadow-sm">
          <h1 className="text-xl font-black uppercase tracking-tight text-foreground">{titulo}</h1>
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mt-1 mb-6">{subtitulo}</p>
          {children}
        </div>
        {rodape && <div className="mt-6 text-center text-xs font-bold text-muted-foreground">{rodape}</div>}
      </div>
    </div>
  );
}

export const authInputCls =
  "w-full bg-secondary/40 border border-border rounded-xl px-5 py-4 text-sm font-bold placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white transition-all";
export const authButtonCls =
  "w-full py-4 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2";
