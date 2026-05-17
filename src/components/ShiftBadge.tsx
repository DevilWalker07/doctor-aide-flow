import { useState, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Building2, ChevronDown, ArchiveRestore, Archive, ArrowRightLeft } from "lucide-react";
import { storage } from "@/lib/storage";

interface PlantaoInfo {
  setor: string;
  data: string;
  data_formatada: string;
  hospital?: string;
}

function readPlantao(): PlantaoInfo | null {
  const p = storage.getPlantaoAtivo();
  if (!p) return null;
  const setor = p.setor || p.sector || p.tipo || "—";
  const dataIso = p.data || p.date || "";
  const dataFmt = p.data_formatada || formatBR(dataIso);
  return { setor, data: dataIso, data_formatada: dataFmt, hospital: p.hospital || "" };
}

function formatBR(iso: string): string {
  if (!iso) return "";
  // "2026-05-16" → "16/05"
  const parts = iso.slice(0, 10).split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}`;
}

interface Props {
  /** Quando true, NÃO redireciona se não houver plantão (mostra placeholder). */
  silent?: boolean;
}

export default function ShiftBadge({ silent = false }: Props) {
  const nav = useNavigate();
  const [plantao, setPlantao] = useState<PlantaoInfo | null>(readPlantao);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Re-ler quando o storage muda (outra aba ou após troca de plantão)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "da_plantao_ativo" || e.key === "da_shift_id") {
        setPlantao(readPlantao());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Click-outside fecha
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!plantao) {
    if (silent) return null;
    return (
      <button
        onClick={() => nav({ to: "/plantoes" })}
        className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md border border-dashed border-border bg-elevated text-[12px] text-muted-foreground hover:bg-subtle transition-colors"
        aria-label="Nenhum plantão ativo, abrir seletor"
      >
        <Building2 className="h-3 w-3" /> Sem plantão ativo
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md border border-border bg-elevated text-[12px] text-foreground hover:bg-subtle transition-colors"
        aria-label={`Plantão ativo: ${plantao.setor} em ${plantao.data_formatada}. Click para opções.`}
        aria-expanded={open}
      >
        <Building2 className="h-3 w-3 text-muted-foreground" />
        <span className="font-medium truncate max-w-[140px]">{plantao.setor}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground tabular-nums">{plantao.data_formatada}</span>
        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Opções de plantão"
          className="absolute right-0 mt-1.5 w-60 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-border bg-subtle">
            <p className="text-[11px] text-muted-foreground">Plantão ativo</p>
            <p className="text-sm font-medium truncate mt-0.5">{plantao.setor}</p>
            {plantao.hospital && (
              <p className="text-[12px] text-muted-foreground truncate">{plantao.hospital}</p>
            )}
          </div>
          <button
            role="menuitem"
            onClick={() => { setOpen(false); nav({ to: "/plantoes" }); }}
            className="w-full px-3 py-2 text-left text-[13px] hover:bg-subtle flex items-center gap-2"
          >
            <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" /> Trocar plantão
          </button>
          <button
            role="menuitem"
            onClick={() => { setOpen(false); nav({ to: "/plantoes", search: { tab: "arquivados" } as any }); }}
            className="w-full px-3 py-2 text-left text-[13px] hover:bg-subtle flex items-center gap-2"
          >
            <ArchiveRestore className="h-3.5 w-3.5 text-muted-foreground" /> Ver arquivados
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              const ok = window.confirm("Encerrar plantão atual? Os dados serão arquivados.");
              if (ok) nav({ to: "/dashboard", search: { encerrar: "1" } as any });
            }}
            className="w-full px-3 py-2 text-left text-[13px] text-destructive hover:bg-destructive/10 flex items-center gap-2 border-t border-border"
          >
            <Archive className="h-3.5 w-3.5" /> Encerrar plantão
          </button>
        </div>
      )}
    </div>
  );
}
