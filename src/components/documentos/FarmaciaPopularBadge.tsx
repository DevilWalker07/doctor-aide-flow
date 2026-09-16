import { Badge } from "@/components/ui/badge";

export function FarmaciaPopularBadge({
  farmaciaPopular,
  controlado,
  compact = false,
}: {
  farmaciaPopular: boolean;
  controlado?: "C1" | "B1" | null;
  compact?: boolean;
}) {
  if (!farmaciaPopular && !controlado) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {farmaciaPopular && (
        <Badge
          variant="success"
          className="print:bg-transparent print:text-black print:border-black/40"
        >
          {compact ? "FARM. POPULAR" : "Farmácia Popular"}
        </Badge>
      )}
      {controlado && (
        <Badge
          variant="warning"
          className="print:bg-transparent print:text-black print:border-black/40"
        >
          {compact ? controlado : `Receita controlada ${controlado}`}
        </Badge>
      )}
    </span>
  );
}
