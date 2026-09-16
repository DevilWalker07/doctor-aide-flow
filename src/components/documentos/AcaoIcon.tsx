import { Droplets, Eye, Hand, Pill, Syringe, User, Wind } from "lucide-react";
import type { Acao } from "@/lib/medical/medicamentos";
import { cn } from "@/lib/utils";

const ICONS: Record<Acao, typeof Pill> = {
  comprimido: Pill,
  gotas: Droplets,
  injecao: Syringe,
  inalacao: Wind,
  topico: Hand,
  oftalmico: Eye,
};

const LABELS: Record<Acao, string> = {
  comprimido: "Tomar",
  gotas: "Tomar (líquido)",
  injecao: "Aplicar injeção",
  inalacao: "Inalar",
  topico: "Passar na pele",
  oftalmico: "Pingar nos olhos",
};

export function acaoLabel(acao: Acao) {
  return LABELS[acao];
}

export function AcaoIcon({ acao, className }: { acao: Acao; className?: string }) {
  const Icon = ICONS[acao];
  return (
    <span
      className={cn(
        "relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary print:bg-transparent print:text-black print:border print:border-black/40",
        className,
      )}
      aria-label={LABELS[acao]}
    >
      <User className="h-7 w-7" strokeWidth={2} aria-hidden="true" />
      <Icon
        className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-white p-0.5 print:bg-white"
        strokeWidth={2.5}
        aria-hidden="true"
      />
    </span>
  );
}
