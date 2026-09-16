import { BedDouble, Moon, Sunrise, Sunset, Utensils } from "lucide-react";
import { HORARIOS, type Horario } from "@/lib/medical/medicamentos";
import { cn } from "@/lib/utils";

const ICONS: Record<Horario, typeof Sunrise> = {
  manha: Sunrise,
  almoco: Utensils,
  tarde: Sunset,
  noite: Moon,
  ao_deitar: BedDouble,
};

const SIZES = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-8 w-8" } as const;

export function HorarioIcon({
  horario,
  size = "md",
  className,
}: {
  horario: Horario;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const Icon = ICONS[horario];
  return <Icon className={cn(SIZES[size], className)} aria-hidden="true" strokeWidth={2.25} />;
}

export function horarioLabel(horario: Horario) {
  return HORARIOS.find((h) => h.id === horario)?.label ?? horario;
}
